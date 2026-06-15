# Design: ADR-003 — Atomicidad ACID de las transiciones de estado

## Technical Approach

Las siete operaciones de transición (`create`, `sendProposal`, `reject`, `confirm`,
`start`, `finish`, `cancel`) deben confirmar **dos** mutaciones —el `UPDATE` del
`estado` de la `Contratacion` y el `INSERT` en `state_change_history`— dentro de una
**única** unidad atómica. Esas mutaciones viven en **módulos distintos**
(`contratacion` y `state-machine`), por lo que la transacción debe **cruzar la
frontera del puerto** `IContratacionStateMachine` sin que ninguno de los dos
servicios de aplicación toque tipos de TypeORM (`DataSource`, `Repository`,
`QueryRunner`, `EntityManager`).

La solución es una **Unit-of-Work detrás de un puerto** (`ITransactionRunner`) que
ejecuta un callback dentro de una transacción y le entrega un **contexto
transaccional opaco** (`TxContext`) — un tipo de dominio (marca/brand), NO el
`EntityManager` de TypeORM. Ese contexto se propaga como **argumento explícito** a
las operaciones de persistencia que deben enlistarse en la misma transacción:

- `IContratacionRepository.save(contratacion, tx?)`
- `IContratacionStateMachine.transitionTo(id, estado, tx?)`

El adaptador TypeORM de cada puerto es el **único** lugar que conoce que `TxContext`
encapsula un `EntityManager`; lo desempaqueta para emitir el SQL contra el manager
transaccional. Si `tx` es `undefined`, el adaptador usa su `Repository` por defecto
(auto-commit) — esto mantiene `list`, `getDetail` y `getHistory` sin cambios.

`ContratacionService` reescribe sus siete métodos para envolver el bloque
"set estado → save → transitionTo" en `txRunner.runInTransaction(tx => …)`. Las
**guardas** (rol, ownership 404, estado actual 409, validaciones 422) quedan
**fuera** del callback: deben fallar antes de abrir transacción (no hay nada que
revertir y se evita ocupar una conexión). La **notificación** (UC19) queda **fuera**
del callback (RN-ACID-06 / RN-SM-04, best-effort).

Esto elimina las **dos** fugas de TypeORM que hoy violan ADR-007:
`ContratacionService` deja de inyectar `@InjectDataSource() DataSource`, y
`StateMachineService` deja de hacer el `INSERT`/`SELECT` contra un
`@InjectRepository(StateChangeHistory)` propio dentro de la ruta de escritura — pasa
a hacerlo a través de un puerto de historial (`IStateChangeHistoryRepository`) que
también acepta `tx`.

## Architecture Decisions

### D1: ¿Cómo propagar la transacción a través del puerto sin leakear TypeORM? (CRÍTICO — ADR-007)

| Opción | Tradeoff | Resolución |
|--------|----------|------------|
| **A: Unit-of-Work con `TxContext` opaco propagado por argumento** | `runInTransaction(work)` abre/commitea/rollbackea; el `TxContext` es un brand de dominio, el `EntityManager` solo existe dentro de los adaptadores. Puerto explícito y fakeable. | ✅ **Elegida** |
| **B: Inyectar `DataSource` y usar `QueryRunner` directo (como hoy `create`)** | Viola ADR-007: el servicio de aplicación importa `DataSource`/`QueryRunner`. Es exactamente la fuga a eliminar. | ❌ Rechazada |
| **C: `cls-hooked`/AsyncLocalStorage (transacción ambiental implícita)** | "Mágica": el `tx` no aparece en la firma, difícil de testear con fakes deterministas y de razonar sobre el límite atómico. Acopla a una librería transversal. | ❌ Rechazada |
| **D: Mover el `UPDATE` de `Contratacion` dentro de `state-machine`** | Rompe ADR-001: `state-machine` pasaría a escribir la entidad de `contratacion`, acoplando ambos módulos en sus internals de persistencia. | ❌ Rechazada |

**Elegida: A.** Cumple ADR-003 (atomicidad real), ADR-007 (TypeORM detrás del
puerto; la capa de aplicación no importa tipos de ORM) y ADR-001 (cada módulo sigue
escribiendo su propia tabla; lo único que se comparte es un *contexto* opaco, no
acceso a los internals del otro). El `TxContext` explícito en la firma hace el límite
atómico legible y testeable.

### D2: ¿Quién es dueño de `ITransactionRunner` y dónde vive?

| Opción | Tradeoff | Resolución |
|--------|----------|------------|
| **A: Módulo `persistence` compartido (`shared/persistence`) que exporta `TRANSACTION_RUNNER` + `TxContext`** | Ambos módulos dependen de una infra común neutral; no se acoplan entre sí. Un solo adaptador `TypeOrmTransactionRunner`. | ✅ **Elegida** |
| **B: Definir el puerto dentro de `contratacion/ports`** | `state-machine` tendría que importar un puerto de `contratacion` solo para tipar `TxContext` → acopla módulos en sentido equivocado. | ❌ Rechazada |
| **C: Duplicar el tipo `TxContext` en cada módulo** | Dos definiciones del brand → el adaptador no puede garantizar que el `tx` recibido sea el suyo. | ❌ Rechazada |

**Elegida: A.** `TxContext` y `TRANSACTION_RUNNER` son infraestructura neutral; un
módulo `persistence` compartido evita el acoplamiento cruzado (ADR-001) y da un único
adaptador TypeORM que sabe abrir el `QueryRunner`.

### D3: `transitionTo` — ¿el `tx` es obligatorio u opcional?

| Opción | Tradeoff | Resolución |
|--------|----------|------------|
| **A: `tx` opcional (`transitionTo(id, estado, tx?)`)** | `create` y las 6 operaciones pasan `tx`; cualquier llamada futura sin transacción sigue compilando. Backward-compatible con `getHistory`/`getDetail` (read path, sin `tx`). | ✅ **Elegida** |
| **B: `tx` obligatorio** | Fuerza a todo caller a abrir transacción incluso en reads; rompe la firma sin beneficio. | ❌ Rechazada |

**Elegida: A.** El **write path** SIEMPRE pasa `tx` (las siete operaciones); el
**read path** (`getHistory`) nunca lo necesita.

### D4: ¿`create` se uniformiza a la misma abstracción? (Spec R5)

Sí. `create` hoy usa `QueryRunner` crudo (fuga ADR-007). Se reescribe sobre
`txRunner.runInTransaction`. La **reserva de franja** (`availabilityService.reserve`)
y su **acción compensatoria** (`release`) se mantienen: `reserve` se invoca **dentro**
del callback (su efecto lógico se revierte vía `release` en el `catch`, porque el slot
no es parte de la transacción de DB). La compensación queda en el `catch` que envuelve
al `runInTransaction`. Resultado: las 7 operaciones comparten exactamente el mismo
patrón (R5).

### D5: Materialización de `estado` y guardas (gate cerrado)

El campo `estado` materializado en `Contratacion` se **conserva** (PC-ACID-01). El
diseño lo exige consistente con la última fila del historial **transaccionalmente**
(RN-ACID-04). `cancel` sobre estado terminal **sigue rechazando con 409**
(PC-ACID-02, no idempotente). Las guardas de estado actual (409) permanecen como
defensa en profundidad **antes** de abrir transacción; el `InvalidTransitionError`
del state-machine sigue siendo la barrera final dentro del callback (provoca rollback).

## Data Flow (operación de transición, p. ej. `confirm`)

```
ContratacionService.confirm(id, userId, role)
  │  1. Guard rol (403) — fuera de tx
  │  2. findById + ownership (404) — fuera de tx
  │  3. Guard estado actual != PRESUPUESTADA (409) — fuera de tx
  ▼
  txRunner.runInTransaction(async (tx) => {        ← abre QueryRunner + startTransaction
  │  4. contratacion.estado = CONFIRMADA
  │  5. contratacionRepo.save(contratacion, tx)    ← UPDATE enlistado en tx
  │  6. stateMachine.transitionTo(id, CONFIRMADA, tx)
  │       ├─ historyRepo.findLast(id, tx) → estadoActual
  │       ├─ valida matriz → InvalidTransitionError ⇒ throw ⇒ ROLLBACK
  │       └─ historyRepo.save({…}, tx)              ← INSERT enlistado en tx
  │  })  ← si el callback resuelve: commitTransaction; si throw: rollbackTransaction
  ▼
  7. stateMachine.notify(...) best-effort          ← FUERA de tx (RN-ACID-06)
  8. return ContratacionResponseDto
```

Punto clave: pasos 5 y 6 usan el **mismo** `tx` → mismo `EntityManager`
transaccional dentro de los adaptadores → un solo commit/rollback. Si el `INSERT` del
historial (paso 6) falla, el `UPDATE` (paso 5) se revierte (RN-ACID-03).

## Interfaces / Contracts

> Recordatorio de build (nodenext): imports relativos con `.js`; interfaces usadas en
> `@Inject(...)` se importan con `import type` junto al token-valor
> (`import { TOKEN, type IPort } from '...'`).

### Nuevo puerto — `server/src/persistence/ports/transaction-runner.port.ts`
```ts
export const TRANSACTION_RUNNER = 'TRANSACTION_RUNNER';

/**
 * Opaque transactional context. Domain/application code NEVER inspects its
 * shape — only adapters unwrap it. The private brand prevents passing a plain
 * object where a real tx is expected.
 */
export interface TxContext {
  readonly __txBrand: unique symbol;
}

export interface ITransactionRunner {
  /**
   * Runs `work` inside a single transaction. Commits if it resolves; rolls
   * back if it throws (the error is re-thrown unchanged). The TxContext passed
   * to `work` MUST be forwarded to every repository/port call that has to
   * enlist in the same atomic unit.
   */
  runInTransaction<T>(work: (tx: TxContext) => Promise<T>): Promise<T>;
}
```

### Puerto modificado — `contratacion/ports/contratacion-repository.port.ts`
```ts
import { type TxContext } from '../../persistence/ports/transaction-runner.port.js';
// ...
export interface IContratacionRepository {
  save(contratacion: Contratacion, tx?: TxContext): Promise<Contratacion>;
  findById(id: string): Promise<Contratacion | null>;
  findByParticipante(filtro: ContratacionFiltro): Promise<Contratacion[]>;
}
```

### Puerto modificado — `contratacion/ports/state-machine.port.ts`
```ts
import { type TxContext } from '../../persistence/ports/transaction-runner.port.js';
// ...
export interface IContratacionStateMachine {
  transitionTo(
    contratacionId: string,
    estado: ContratacionEstado,
    tx?: TxContext,
  ): Promise<void>;
  getHistory(contratacionId: string): Promise<StateChangeHistory[]>;
}
```

### Nuevo puerto — `state-machine/ports/state-change-history-repository.port.ts`
Extrae el acceso a `state_change_history` detrás de un puerto (elimina la fuga de
`@InjectRepository` en `StateMachineService`, ADR-007).
```ts
export const STATE_CHANGE_HISTORY_REPOSITORY = 'STATE_CHANGE_HISTORY_REPOSITORY';

export interface IStateChangeHistoryRepository {
  findLast(contratacionId: string, tx?: TxContext): Promise<StateChangeHistory | null>;
  findAll(contratacionId: string): Promise<StateChangeHistory[]>; // read path, ordered ASC
  save(
    record: { contratacionId: string; estadoAnterior: ContratacionEstado | null; estadoNuevo: ContratacionEstado },
    tx?: TxContext,
  ): Promise<void>;
}
```

### Adaptador — `server/src/persistence/adapters/typeorm-transaction-runner.ts`
Único lugar autorizado a tocar `DataSource`/`QueryRunner`/`EntityManager`.
```ts
@Injectable()
export class TypeOrmTransactionRunner implements ITransactionRunner {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async runInTransaction<T>(work: (tx: TxContext) => Promise<T>): Promise<T> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      // qr.manager (EntityManager) is wrapped as the opaque TxContext
      const result = await work(qr.manager as unknown as TxContext);
      await qr.commitTransaction();
      return result;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }
}
```
Los adaptadores de repositorio desempaquetan el `tx`:
```ts
// TypeOrmContratacionRepository.save
const manager = (tx as unknown as EntityManager) ?? this.repo.manager;
return manager.save(Contratacion, contratacion);
```

### DI binding
- Nuevo `PersistenceModule` (`server/src/persistence/persistence.module.ts`):
  `providers: [{ provide: TRANSACTION_RUNNER, useClass: TypeOrmTransactionRunner }]`,
  `exports: [TRANSACTION_RUNNER]`. Importado por `ContratacionModule`.
- `ContratacionModule`: inyecta `TRANSACTION_RUNNER` en `ContratacionService` (reemplaza `@InjectDataSource()`).
- `StateMachineModule`: añade
  `{ provide: STATE_CHANGE_HISTORY_REPOSITORY, useClass: TypeOrmStateChangeHistoryRepository }`;
  `StateMachineService` pasa a inyectar ese token (reemplaza `@InjectRepository(StateChangeHistory)`).

## OCL-style pre/postconditions (se vuelven asserts de test — ADR-006)

Contexto: `op` ∈ {`sendProposal`,`reject`,`confirm`,`start`,`finish`,`cancel`,`create`}.
Sea `c = Contratacion`, `H = state_change_history` filtrado por `c.id`,
`last(H)` = fila de mayor `timestamp`.

**Invariante global (RN-ACID-04, siempre):**
```
inv: c.estado == last(H).estadoNuevo
```

**`transitionTo` válida (R1, R5):**
```
pre:  c.estado == estadoOrigen  and  matriz[estadoOrigen] includes estadoDestino
post: c.estado == estadoDestino
post: H@post->size() == H@pre->size() + 1
post: last(H).estadoAnterior == estadoOrigen  and  last(H).estadoNuevo == estadoDestino
post: c.estado == last(H).estadoNuevo                       -- inv se mantiene
```

**Transición inválida / estado terminal (R2):**
```
pre:  not (matriz[c.estado] includes estadoDestino)
post: c.estado == c.estado@pre                              -- sin cambios
post: H@post->size() == H@pre->size()                       -- ninguna fila nueva
post: last(H) == last(H)@pre
```

**Fallo de persistencia en INSERT de historial (R3, rollback):**
```
pre:  c.estado == estadoOrigen  and  historyRepo.save lanza error
post: c.estado == estadoOrigen@pre                          -- UPDATE revertido
post: H@post->size() == H@pre->size()                       -- ninguna fila nueva
post: not H->exists(h | h.estadoNuevo == estadoDestino and h.timestamp > t0)
post: operación lanza (no resuelve)
```

**Notificación best-effort (R6):**
```
pre:  transición ya confirmada (commit hecho)  and  notifier.notify lanza
post: c.estado == estadoDestino                             -- NO se revierte
post: last(H).estadoNuevo == estadoDestino                  -- fila persiste
post: operación resuelve normalmente
```

## Testing Strategy — fakes in-memory (sin Postgres/Redis real)

Los unit tests NO levantan DB; la fakeabilidad la habilita el puerto
`ITransactionRunner` + `TxContext` opaco. Patrón:

**`FakeTransactionRunner` + `InMemoryStore` (modela commit/rollback):**
- El store mantiene `committed` (estado confirmado) y `staging` (mutaciones del tx en curso).
- `runInTransaction(work)`:
  1. crea un `tx` (objeto-marca que apunta a un buffer `staging`),
  2. ejecuta `await work(tx)`,
  3. si resuelve → `commit()`: vuelca `staging` sobre `committed`,
  4. si lanza → `rollback()`: descarta `staging` y re-lanza.
- `FakeContratacionRepository.save(c, tx)` y `FakeHistoryRepository.save(r, tx)`
  escriben en `staging` cuando `tx` está presente, o en `committed` si no.
  `findLast(id, tx)` lee de `staging∪committed` para ver lo escrito en el mismo tx.

**Cómo cada requisito se vuelve testeable:**

| Req | Test con fakes |
|-----|----------------|
| R1 / R5 | Tras `op` exitosa: `committed.contratacion.estado == destino` **y** `committed.history` tiene 1 fila nueva con `estadoAnterior/estadoNuevo` correctos. Recorrido completo del ciclo de vida: assert `inv` en cada paso. |
| R2 | `op` con transición ilegal: el callback lanza `InvalidTransitionError` antes del `save` de historial → `rollback` → `committed` intacto (estado y historial sin cambios). |
| **R3 (clave)** | Configurar `FakeHistoryRepository.save` para **lanzar** un error de persistencia simulado. Como la entidad ya se escribió en `staging`, el `throw` dispara `rollback()` del `FakeTransactionRunner` → `staging` se descarta → `committed.contratacion.estado` sigue siendo el origen y no hay fila nueva. Esto prueba el rollback SIN DB real. |
| R4 | Helper `assertConsistent(store)`: `committed.contratacion.estado == last(committed.history).estadoNuevo`. Se invoca tras cada caso (éxito y fallo). |
| R6 | `FakeNotifier.notify` lanza; assert que la `op` igual resuelve y `committed` conserva entidad+historial (la notificación está fuera de `runInTransaction`). |

El test de `StateMachineService` se hace con `FakeHistoryRepository` (sin TypeORM).
El test de `ContratacionService` inyecta `FakeTransactionRunner`,
`FakeContratacionRepository`, un fake de `IContratacionStateMachine` que comparte el
mismo `InMemoryStore`/`tx`, y fakes de user/availability.

> Nota CI: `ts-jest` transpila y NO detecta TS1272 ni el `.js` faltante en imports;
> solo `nest build` lo hace. Por eso las firmas arriba ya usan `import type` para las
> interfaces y `.js` en los imports relativos.

## File Changes

| File | Action | Descripción |
|------|--------|-------------|
| `server/src/persistence/ports/transaction-runner.port.ts` | Create | `TRANSACTION_RUNNER`, `TxContext` (opaco), `ITransactionRunner` |
| `server/src/persistence/adapters/typeorm-transaction-runner.ts` | Create | Único punto con `DataSource`/`QueryRunner`; envuelve `EntityManager` como `TxContext` |
| `server/src/persistence/persistence.module.ts` | Create | Provee y exporta `TRANSACTION_RUNNER` |
| `server/src/state-machine/ports/state-change-history-repository.port.ts` | Create | `STATE_CHANGE_HISTORY_REPOSITORY`, `IStateChangeHistoryRepository` (con `tx?`) |
| `server/src/state-machine/adapters/typeorm-state-change-history.repository.ts` | Create | Implementa el puerto; desempaqueta `tx`→`EntityManager`, fallback a `Repository` |
| `server/src/contratacion/ports/contratacion-repository.port.ts` | Modify | `save(c, tx?)` |
| `server/src/contratacion/ports/state-machine.port.ts` | Modify | `transitionTo(id, estado, tx?)` |
| `server/src/contratacion/adapters/typeorm-contratacion.repository.ts` | Modify | `save` desempaqueta `tx`→`EntityManager`, fallback a `this.repo` |
| `server/src/contratacion/application/contratacion.service.ts` | Modify | Quita `@InjectDataSource`/`DataSource`; inyecta `TRANSACTION_RUNNER`; envuelve las 7 ops en `runInTransaction`; guards y notify fuera del callback |
| `server/src/state-machine/application/state-machine.service.ts` | Modify | Quita `@InjectRepository(StateChangeHistory)`/`Repository`; inyecta `STATE_CHANGE_HISTORY_REPOSITORY`; propaga `tx` a `findLast`/`save`; notify sigue best-effort |
| `server/src/contratacion/contratacion.module.ts` | Modify | Importa `PersistenceModule` (para `TRANSACTION_RUNNER`) |
| `server/src/state-machine/state-machine.module.ts` | Modify | Bind `STATE_CHANGE_HISTORY_REPOSITORY` → `TypeOrmStateChangeHistoryRepository` |
| `server/src/app.module.ts` | Modify (verificar) | Asegurar que `PersistenceModule` esté disponible donde se importa; sin cambios de entidades |
| `server/src/contratacion/application/contratacion.service.spec.ts` | Create/Modify | Fakes in-memory + `FakeTransactionRunner`; cubre R1–R6 |
| `server/src/state-machine/application/state-machine.service.spec.ts` | Modify | Usa `FakeHistoryRepository`; valida `tx` propagado y rollback (R3) |

## Migration / Rollout

**Sin migración de datos.** El esquema de `contrataciones` y `state_change_history`
no cambia (mismas columnas, mismo `estado` materializado). Solo cambian firmas de
puertos, wiring de DI y el cuerpo de los servicios.

**Demo seed / e2e — no afectados.** El seed crea filas vía las mismas operaciones (o
inserts directos); como los adaptadores caen al `Repository`/auto-commit por defecto
cuando `tx` es `undefined`, cualquier camino que hoy no pasa `tx` sigue funcionando.
Los e2e ejercitan el endpoint HTTP: el comportamiento observable (estados, historial,
códigos 403/404/409/422) es idéntico; solo cambia que ahora es atómico.

## Open Questions

- **PC-ACID-02 (gate ya cerrado):** `cancel` sobre estado terminal **mantiene** el
  rechazo 409 (no idempotente). No reabrir.
- Ninguna otra: D1–D5 resueltas. El único punto a confirmar en el gate de diseño es si
  se prefiere ubicar `ITransactionRunner` en un módulo `persistence` compartido
  (recomendado, D2-A) o reutilizar un módulo común ya existente — verificar que no haya
  un `shared/` previo antes de crear `persistence/`.
