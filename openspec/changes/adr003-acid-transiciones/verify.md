# Verificación — ADR-003 Atomicidad ACID de las transiciones

**Veredicto general: APPROVED.**

Implementación verificada de forma independiente contra `spec.md` (RN-ACID-01..06,
escenarios R1..R6) y `design.md` (Unit-of-Work `ITransactionRunner` + `TxContext`
opaco; puerto `IStateChangeHistoryRepository`; capa de aplicación sin tipos TypeORM).
La suite completa pasa, el lint queda limpio y no se introducen errores de tipo nuevos
en los archivos modificados. Se registran tres CONCERN menores que NO bloquean archive.

---

## 1. Cobertura de escenarios R1..R6

| Esc. | Regla(s)            | Test (archivo:línea)                                                                 | Veredicto |
|------|---------------------|--------------------------------------------------------------------------------------|-----------|
| R1   | RN-ACID-01          | `contratacion.service.spec.ts:414` `R1: confirm() commits entity + history`          | PASS — asserta estado committed = CONFIRMADA, +1 fila con `estadoAnterior/estadoNuevo`, e invariante. |
| R2   | RN-ACID-02          | `contratacion.service.spec.ts:443` (confirm sobre SOLICITADA) y `:466` (cancel sobre FINALIZADA terminal) | PASS — verifica estado intacto + 0 filas nuevas. Reforzado por `state-machine.service.spec.ts:157` y `:172` (matriz lanza `InvalidTransitionError`, 0 saves). |
| R3   | RN-ACID-03          | `contratacion.service.spec.ts:487` (start) y `:513` (cancel)                          | PASS — ver §2 (rollback real). Reforzado por `state-machine.service.spec.ts:191` (la propagación del error del save corta la op). |
| R4   | RN-ACID-04/05       | `contratacion.service.spec.ts:535` (éxito) y `:552` (fallo persistencia)             | PASS — helper `assertConsistent` (`:368`) asserta `committedEstado == last(committedHistory).estadoNuevo` tras éxito y tras fallo, además de invocarse al final de TODOS los casos R1/R2/R3/R5. |
| R5   | RN-ACID-05          | `contratacion.service.spec.ts:571` (ciclo create→sendProposal→confirm→start→finish, asserta invariante en cada paso, 5 filas), `:613` (cancel no terminal), `:634` (reject) | PASS — cubre las 7 ops. `create` y los 4 pasos del ciclo más `cancel` y `reject` ejercitan transacción + invariante reales. |
| R6   | RN-ACID-06          | `state-machine.service.spec.ts:214` y `:230` (`notifier.notify` rechaza → la transición igual resuelve, historia persiste) | PASS — prueba genuina de best-effort. Ver CONCERN-1 sobre el test homónimo en el spec de contratación. |

Todas las reglas RN-ACID-01..06 tienen al menos un test con aserción genuina.

## 2. R3 — el rollback es REAL (no un stub trivial)

PASS. El `FakeTransactionRunner` (`contratacion.service.spec.ts:138`) NO commitea de
forma eager: usa un `InMemoryStore` (`:67`) con buffers `committed` y `staging`.

- `begin()` (`:71`) clona `committed` en `staging`.
- `saveContratacion(c, tx)` (`:94`) escribe en `staging` cuando hay `tx` (vía
  `writeTarget`, `:85`).
- En el callback de `start()`: el `save` del UPDATE a EN_CURSO va a `staging`; luego
  `FakeStateMachine.append` (`:237`) lanza porque `failHistory=true` (`:243`).
- El `throw` dispara `rollback()` (`:80`), que **descarta `staging`** dejando
  `committed` intacto.

El test (`:487`) verifica entonces que `committedEstado == CONFIRMADA` (el UPDATE a
EN_CURSO desapareció), 0 filas nuevas, y ninguna fila con `estadoNuevo == EN_CURSO`.
Esto prueba que la mutación enlistada se descarta ante el fallo del INSERT de historial.
No es un stub que pasa trivialmente: si el runner comiteara de forma eager el estado
quedaría en EN_CURSO y el test fallaría. La semántica commit/rollback del fake es fiel.

## 3. Sin TypeORM en la capa de aplicación (ADR-007)

PASS. `rg "from 'typeorm'|@InjectRepository|@InjectDataSource|@nestjs/typeorm"` sobre
`src/contratacion/application` y `src/state-machine/application` no devuelve nada
(exit 1). El cast `EntityManager as unknown as TxContext` en código de producción vive
ÚNICAMENTE en `persistence/adapters/typeorm-transaction-runner.ts:27`. Las otras dos
ocurrencias de `as unknown as TxContext` están en archivos `*.spec.ts` (construcción de
fakes), lo cual es legítimo. Los adaptadores desempaquetan `tx → EntityManager` en
`typeorm-contratacion.repository.ts:22-23` y `typeorm-state-change-history.repository.ts:53-55`.

## 4. Las 7 operaciones envueltas en `runInTransaction`

PASS. Verificado leyendo `contratacion.service.ts`:
- `create` (`:115`), `sendProposal` (`:395`), `reject` (`:459`), `confirm` (`:525`),
  `start` (`:570`), `finish` (`:615`), `cancel` (`:664`).

En cada una el bloque `save(contratacion, tx)` + `stateMachine.transitionTo(id, estado, tx)`
ocurre dentro del callback de `runInTransaction`, propagando el mismo `tx`. Ninguna
persiste fuera de la transacción. Las guardas (rol/ownership/estado actual/validaciones)
quedan ANTES de abrir la transacción, conforme a D5.

## 5. Invariante RN-ACID-04 (entity.estado == último estadoNuevo) tras éxito y fallo

PASS. `assertConsistent(store, id)` (`:368`) se invoca tras éxito (R1 `:437`, R4 `:549`,
R5 todos los pasos) y tras fallo (R2 `:463`/`:481`, R3 `:510`/`:529`, R4 `:565`). La
invariante se sostiene en ambos caminos.

## 6. Sin regresiones — suite, lint, tipos

- `npm test`: **15 suites passed, 185 passed, 1 skipped, 186 total**. CLEAN.
- `npm run lint`: **exit 0, sin findings**.
- `npx tsc --noEmit`: 4 errores, TODOS en archivos SPEC pre-existentes y NO relacionados
  (`auth/application/auth.service.spec.ts`, `catalogo/application/buscador.service.spec.ts`).
  CERO errores nuevos en los archivos modificados por este cambio. Estos specs quedan
  excluidos de `tsconfig.build` (no llegan al gate de build). No se ejecutó `build`
  (convención de equipo).
- DI: `ContratacionModule` importa `PersistenceModule` (`contratacion.module.ts:59`);
  `StateMachineModule` bindea `STATE_CHANGE_HISTORY_REPOSITORY → TypeOrmStateChangeHistoryRepository`
  (`state-machine.module.ts:36-39`). Wiring correcto.

---

## CONCERN (no bloqueantes)

- **CONCERN-1 (test hollow parcial, R6):** el test `R6` del spec de contratación
  (`contratacion.service.spec.ts:658`) NO falla un notifier real: corre un `sendProposal`
  exitoso y asserta persistencia. Su propio comentario admite que "modela" el caso. La
  prueba GENUINA de R6 vive en `state-machine.service.spec.ts:214`/`:230`. R6 está cubierto,
  pero el test del spec de contratación no aporta evidencia propia del best-effort. Sugerencia:
  renombrarlo o inyectar un notifier que falle a través del state machine real.

- **CONCERN-2 (ubicación de notify vs design):** `design.md §Data Flow` paso 7 ubica la
  notificación FUERA de la transacción (post-commit). En la implementación, `notifyBestEffort`
  se ejecuta DENTRO de `transitionTo` (es decir, dentro del callback de `runInTransaction`,
  antes del commit), pero traga sus propios errores (`state-machine.service.ts:107`), por lo
  que jamás puede abortar la transacción. El contrato observable de R6/RN-ACID-06 se cumple,
  pero la ubicación literal difiere del diseño. Aceptable; documentarlo si se desea fidelidad estricta.

- **CONCERN-3 (R2 vía guarda, no vía matriz, en contratación):** el test `R2: confirm() on
  SOLICITADA` (`:443`) falla en la guarda de estado actual (409) ANTES de abrir la transacción,
  no en la matriz del state machine. Es correcto (defensa en profundidad) y el test lo reconoce,
  pero la barrera de la matriz dentro del callback se prueba por separado en el spec del state
  machine (`:157`/`:172`). Cobertura completa entre ambos archivos.

Ninguno de los tres CONCERN compromete la garantía ACID ni bloquea el archive.
