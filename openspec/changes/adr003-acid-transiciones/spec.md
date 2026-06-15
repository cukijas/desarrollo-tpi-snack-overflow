# ADR-003 — Atomicidad ACID de las transiciones de estado (Spec de cambio)

## Propósito

Cerrar la brecha entre la decisión ADR-003 ("Toda operación crítica —pago, **transición de estado**— es transaccional ACID") y el comportamiento actual del sistema.

Hoy, toda transición de estado de una `Contratacion` distinta de la creación (`create`) se ejecuta en **dos commits independientes**:

1. La actualización del campo `estado` de la `Contratacion` (un `save` de la entidad).
2. La inserción de la fila correspondiente en `state_change_history` (vía `transitionTo`).

Como el estado actual de una contratación se **deriva de la última fila** de `state_change_history` (RN-SM-06), si el segundo paso falla después de que el primero comiteó, la entidad persistida y su estado derivado **discrepan**: la `Contratacion` queda con un `estado` para el que no existe fila de historial. Esto es exactamente el estado inconsistente que ADR-003 prohíbe.

Este cambio especifica que **cada** transición de estado de una contratación —no solo la creación— debe ser **atómica**: la actualización de la entidad y la inserción en `state_change_history` confirman juntas (commit) o se revierten juntas (rollback). No se especifica el mecanismo (eso es responsabilidad de la etapa de Diseño); se especifica únicamente el **contrato observable**.

Este cambio NO modifica el grafo de transiciones legales (definido en `../../specs/state-machine/spec.md`), ni los roles autorizados, ni los códigos HTTP de cada caso de uso. Solo refuerza la garantía de atomicidad sobre las operaciones existentes.

## Operaciones cubiertas

La garantía de atomicidad aplica a **todas** las operaciones que producen una transición de estado de una contratación. En el servicio actual son:

| Operación | Caso de uso | Transición | Estado origen requerido | Estado destino |
|-----------|-------------|------------|-------------------------|----------------|
| `create` | UC07 | (inicial) → solicitada | — | `solicitada` |
| `sendProposal` | UC08 | solicitada → presupuestada | `solicitada` | `presupuestada` |
| `reject` | UC08 | solicitada → cancelada | `solicitada` | `cancelada` |
| `confirm` | UC21 | presupuestada → confirmada | `presupuestada` | `confirmada` |
| `start` | UC20 | confirmada → en_curso | `confirmada` | `en_curso` |
| `finish` | UC13 | en_curso → finalizada | `en_curso` | `finalizada` |
| `cancel` | UC10 | {solicitada, presupuestada, confirmada, en_curso} → cancelada | estado no terminal | `cancelada` |

> `create` ya es atómica en el código actual; queda incluida en el contrato para que la garantía sea uniforme y no se degrade en el futuro. Las demás (`sendProposal`, `reject`, `confirm`, `start`, `finish`, `cancel`) son las que hoy violan la garantía.

## Requisitos

### Reglas de negocio

| ID | Regla |
|----|-------|
| RN-ACID-01 | En **toda** transición de estado, la actualización de la `Contratacion` y la inserción de la fila en `state_change_history` **DEBEN** confirmarse de forma atómica: ambas o ninguna. |
| RN-ACID-02 | Si la transición es **inválida** según la matriz (RN-SM-01) o el estado origen no la admite, **NO DEBE** persistirse ningún cambio: ni el `estado` de la `Contratacion` ni una nueva fila de `state_change_history`. |
| RN-ACID-03 | Si la inserción en `state_change_history` falla por un error de persistencia (p. ej. error de base de datos) tras haber actualizado la entidad, la actualización de la `Contratacion` **DEBE** revertirse íntegramente. |
| RN-ACID-04 | Tras cualquier operación —exitosa o fallida— el `estado` persistido de la `Contratacion` **DEBE** coincidir con el `estadoNuevo` de la última fila de `state_change_history` para esa contratación (invariante de consistencia, RN-SM-06). |
| RN-ACID-05 | La invariante RN-ACID-04 **DEBE** sostenerse para las siete operaciones enumeradas; ninguna queda exenta. |
| RN-ACID-06 | La notificación post-transición (UC19) sigue siendo **best-effort** (RN-SM-04): su fallo **NO** revierte la transición ya confirmada y queda **fuera** del límite transaccional. |

> RN-ACID-06 mantiene el comportamiento existente: la notificación no debe arrastrar el commit hacia un rollback. La atomicidad cubre la entidad y el historial; no la notificación.

### R1: Atomicidad de la transición válida

Toda operación de transición **DEBE** confirmar la actualización de la `Contratacion` y la inserción en `state_change_history` dentro de una misma unidad atómica. Al observar el resultado de una operación exitosa, ambas mutaciones están presentes y consistentes entre sí.

#### Escenario: Transición válida confirma entidad e historial atómicamente

- **Dado** una contratación en estado *presupuestada*
- **Cuando** su cliente ejecuta `confirm`
- **Entonces** el `estado` persistido de la contratación es *confirmada*
- **Y** existe una nueva fila en `state_change_history` con `estadoAnterior = presupuestada`, `estadoNuevo = confirmada` y `timestamp`
- **Y** ambas mutaciones quedaron confirmadas en la misma unidad atómica

### R2: Transición inválida no persiste nada

Cuando la transición solicitada no está permitida por la matriz (RN-SM-01) o el estado origen no la admite, la operación **DEBE** fallar sin modificar el `estado` de la `Contratacion` ni crear filas en `state_change_history`.

#### Escenario: Transición inválida deja entidad e historial intactos

- **Dado** una contratación en estado *solicitada* (estado para el cual `confirm` no es una transición legal)
- **Cuando** se intenta `confirm` sobre ella
- **Entonces** la operación es rechazada
- **Y** el `estado` persistido de la contratación sigue siendo *solicitada*
- **Y** no se crea ninguna fila nueva en `state_change_history`
- **Y** la última fila del historial sigue siendo la previa a la operación

#### Escenario: Transición desde estado terminal no persiste nada

- **Dado** una contratación en estado *finalizada* (terminal)
- **Cuando** se intenta `cancel` sobre ella
- **Entonces** la operación es rechazada
- **Y** el `estado` persistido sigue siendo *finalizada*
- **Y** no se crea ninguna fila nueva en `state_change_history`

### R3: Rollback ante fallo en la inserción del historial

Si la actualización de la entidad ya ocurrió dentro de la operación pero la inserción en `state_change_history` falla por un error de persistencia, la operación **DEBE** revertir la actualización de la entidad. Al finalizar, ni la entidad ni el historial reflejan la transición.

#### Escenario: Error al insertar el historial revierte la actualización de la entidad

- **Dado** una contratación en estado *confirmada*
- **Y** que la inserción en `state_change_history` falla con un error de persistencia simulado durante la operación `start`
- **Cuando** se ejecuta `start` sobre la contratación
- **Entonces** la operación falla
- **Y** el `estado` persistido de la contratación sigue siendo *confirmada* (la actualización a *en_curso* fue revertida)
- **Y** no existe fila en `state_change_history` con `estadoNuevo = en_curso` para esa contratación

#### Escenario: Error de persistencia en una operación de cancelación revierte todo

- **Dado** una contratación en estado *solicitada*
- **Y** que la inserción en `state_change_history` falla con un error de persistencia simulado durante la operación `cancel`
- **Cuando** se ejecuta `cancel` sobre la contratación
- **Entonces** la operación falla
- **Y** el `estado` persistido sigue siendo *solicitada*
- **Y** no se crea ninguna fila nueva en `state_change_history`

### R4: Invariante de consistencia entidad ↔ historial

Después de **cualquier** operación de transición, sea exitosa o fallida, el `estado` persistido de la `Contratacion` **DEBE** ser igual al `estadoNuevo` de la última fila (por `timestamp`) de `state_change_history` para esa contratación.

#### Escenario: La consistencia se mantiene tras una operación exitosa

- **Dado** una contratación en estado *solicitada* con su historial coherente
- **Cuando** su prestador ejecuta `sendProposal` exitosamente
- **Entonces** el `estado` persistido es *presupuestada*
- **Y** el `estadoNuevo` de la última fila de `state_change_history` es *presupuestada*
- **Y** ambos valores coinciden

#### Escenario: La consistencia se mantiene tras una operación fallida

- **Dado** una contratación cuyo `estado` persistido coincide con el `estadoNuevo` de la última fila del historial
- **Cuando** una operación de transición falla (por transición inválida o por error de persistencia)
- **Entonces** el `estado` persistido sigue coincidiendo con el `estadoNuevo` de la última fila del historial
- **Y** no queda ninguna contratación cuyo `estado` carezca de fila de historial correspondiente

### R5: Cobertura uniforme de todas las operaciones

La garantía de atomicidad y la invariante de consistencia **DEBEN** aplicar a las siete operaciones: `create`, `sendProposal`, `reject`, `confirm`, `start`, `finish`, `cancel`. Ninguna queda exenta.

#### Escenario: Recorrido completo del ciclo de vida mantiene la consistencia en cada paso

- **Dado** una contratación recién creada vía `create` (estado *solicitada*)
- **Cuando** atraviesa `sendProposal` → *presupuestada*, `confirm` → *confirmada*, `start` → *en_curso* y `finish` → *finalizada*
- **Entonces** tras **cada** operación el `estado` persistido coincide con el `estadoNuevo` de la última fila de `state_change_history`
- **Y** cada transición confirmó entidad e historial atómicamente

#### Escenario: La cancelación desde un estado no terminal es atómica

- **Dado** una contratación en estado *en_curso*
- **Cuando** un participante ejecuta `cancel`
- **Entonces** el `estado` persistido es *cancelada*
- **Y** existe una nueva fila en `state_change_history` con `estadoAnterior = en_curso` y `estadoNuevo = cancelada`
- **Y** ambas mutaciones se confirmaron atómicamente

#### Escenario: El rechazo de una solicitud es atómico

- **Dado** una contratación en estado *solicitada*
- **Cuando** su prestador ejecuta `reject`
- **Entonces** el `estado` persistido es *cancelada*
- **Y** existe una nueva fila en `state_change_history` con `estadoAnterior = solicitada` y `estadoNuevo = cancelada`
- **Y** ambas mutaciones se confirmaron atómicamente

### R6: La notificación queda fuera del límite transaccional (best-effort)

El fallo de la notificación post-transición (UC19) **NO DEBE** revertir una transición ya confirmada. La notificación es best-effort (RN-SM-04) y no forma parte de la unidad atómica.

#### Escenario: Fallo de notificación no revierte la transición

- **Dado** una transición válida *solicitada* → *presupuestada* que confirmó entidad e historial
- **Cuando** la notificación posterior falla
- **Entonces** el `estado` persistido sigue siendo *presupuestada*
- **Y** la fila de `state_change_history` permanece
- **Y** la invariante de consistencia (RN-ACID-04) se mantiene

## Fuera de alcance

- El **mecanismo** de atomicidad (transacción de base de datos, unidad de trabajo, propagación del contexto transaccional a la máquina de estados, etc.) — responsabilidad de la etapa de **Diseño**. Esta spec describe QUÉ debe cumplirse, no CÓMO.
- El **grafo de transiciones legales**, los roles autorizados y los códigos HTTP de cada caso de uso — ya definidos en `../../specs/state-machine/spec.md` y `../../specs/contratacion/spec.md`; este cambio no los altera.
- La **reserva atómica de franja** (RN-CON-04) en `create` — ya cubierta por la spec de contratación; este cambio no la modifica.
- La **inmutabilidad append-only** del historial (RN-SM-03) — preexistente y no afectada.

## Preguntas abiertas / supuestos

| ID | Estado | Resolución |
|----|--------|-----------|
| PC-ACID-01 | Supuesto | La entidad `Contratacion` mantiene un campo `estado` materializado **además** del historial. Este cambio asume que ese campo se conserva y se exige que sea consistente con el historial (RN-ACID-04); no propone eliminarlo. |
| PC-ACID-02 | Pregunta abierta | ¿Debe la operación `cancel` ser idempotente cuando ya está en estado terminal (devolver el estado actual sin error) o seguir rechazando con conflicto? La spec actual mantiene el rechazo; confirmar en el gate si se desea otro comportamiento. |
