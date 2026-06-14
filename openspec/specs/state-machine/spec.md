# State Machine — Máquina de estados de la contratación (Spec)

## Propósito

Centraliza y valida **todas** las transiciones de estado de `Contratacion` aplicando el patrón State. Es la única fuente de verdad para el grafo de transiciones legales: recibe solicitudes de cambio desde los demás casos de uso (UC07, UC08, UC10, UC13, UC20, UC21), admite únicamente las transiciones definidas en la matriz, persiste el nuevo estado y registra cada cambio en un historial inmutable. El **estado actual de una contratación se deriva de la última fila** de `state_change_history` (la entrada más reciente por `timestamp`), no de un campo mutable independiente.

Cubre RF-6.4 (gestión de estados de la contratación) y RF-6.7 (historial de cambios de estado), y da soporte a la cancelación de RF-6.6.

## Estados y transiciones válidas

Los estados de la contratación son: `solicitada`, `presupuestada`, `confirmada`, `en_curso`, `finalizada`, `cancelada`.

El grafo de transiciones legales es **exactamente**:

- `solicitada` → { `presupuestada`, `cancelada` }
- `presupuestada` → { `confirmada`, `cancelada` }
- `confirmada` → { `en_curso`, `cancelada` }
- `en_curso` → { `finalizada`, `cancelada` }
- `finalizada` → ∅ (terminal)
- `cancelada` → ∅ (terminal)

| Desde \ Hacia    | PRESUPUESTADA | CONFIRMADA | EN_CURSO | FINALIZADA | CANCELADA   |
|------------------|---------------|------------|----------|------------|-------------|
| **SOLICITADA**   | UC08          | —          | —        | —          | UC08 / UC10 |
| **PRESUPUESTADA**| —             | UC21       | —        | —          | UC21 / UC10 |
| **CONFIRMADA**   | —             | —          | UC20     | —          | UC10        |
| **EN_CURSO**     | —             | —          | —        | UC13       | UC10        |
| **FINALIZADA**   | —             | —          | —        | —          | —           |
| **CANCELADA**    | —             | —          | —        | —          | —           |

> `solicitada` es el estado inicial, fijado por UC07 al crear la contratación. `finalizada` y `cancelada` son **terminales**: desde ellas no existe ninguna transición válida.

No existen los estados `RECHAZADA` ni `ACEPTADA`: el rechazo de una solicitud (UC08) y la cancelación (UC10) resuelven en `cancelada`, y la aceptación de propuesta (UC21) resuelve en `confirmada`. Cualquier intención de transición fuera de este grafo es **ilegal** y debe rechazarse.

## Requisitos

| Código | Prioridad | Descripción |
|--------|-----------|-------------|
| RF-6.4 | Obligatorio | El sistema *deberá* gestionar los estados de la contratación (solicitada, presupuestada, confirmada, en curso, finalizada, cancelada). |
| RF-6.7 | Obligatorio | El sistema *deberá* registrar el historial de cambios de estado de la contratación. |

### Reglas de negocio

| ID       | Regla                                                                                  |
|----------|----------------------------------------------------------------------------------------|
| RN-SM-01 | Toda transición **DEBE** ser válida según la matriz; las no listadas se rechazan.      |
| RN-SM-02 | `finalizada` y `cancelada` son estados **terminales**.                                 |
| RN-SM-03 | El historial `state_change_history` es **append-only e inmutable**.                    |
| RN-SM-04 | La notificación (UC19) es **best-effort**: no bloquea ni revierte la transición.       |
| RN-SM-05 | El estado inicial **SIEMPRE** es `solicitada`.                                          |
| RN-SM-06 | El estado actual se **deriva de la última fila** de `state_change_history` (por `timestamp`). |
| RN-SM-07 | Solo un **participante** de la contratación (su cliente o su prestador) puede consultar el historial; cada transición la origina el caso de uso autorizado para esa transición. |

### R1: Validar transición y persistir nuevo estado

El sistema **DEBE** validar que la transición (estado actual → estado destino) esté en la matriz. Si es válida, **DEBE** registrar el cambio en `state_change_history`; el nuevo estado actual queda determinado por esa nueva última fila.

#### Escenario: Transición solicitada → presupuestada

- **Dado** una contratación en estado *solicitada*
- **Cuando** se recibe `transitionTo(id, PRESUPUESTADA)`
- **Entonces** la contratación pasa a *presupuestada*
- **Y** se crea un registro en `state_change_history` con `estadoAnterior`, `estadoNuevo` y `timestamp`

### R2: Rechazar transición ilegal

El sistema **DEBE** rechazar toda transición no listada en la matriz lanzando `InvalidTransitionError`, sin modificar el estado actual ni crear registros en el historial.

#### Escenario: Transición desde estado terminal (finalizada)

- **Dado** una contratación en estado *finalizada*
- **Cuando** se recibe `transitionTo(id, EN_CURSO)`
- **Entonces** el sistema lanza `InvalidTransitionError`
- **Y** la contratación permanece en *finalizada*
- **Y** no se crean registros en `state_change_history`

#### Escenario: Transición desde estado terminal (cancelada)

- **Dado** una contratación en estado *cancelada*
- **Cuando** se recibe `transitionTo(id, SOLICITADA)`
- **Entonces** el sistema lanza `InvalidTransitionError`
- **Y** la contratación permanece en *cancelada*

#### Escenario: Salto ilegal entre estados no adyacentes

- **Dado** una contratación en estado *solicitada*
- **Cuando** se recibe `transitionTo(id, EN_CURSO)` (destino no alcanzable desde *solicitada*)
- **Entonces** el sistema lanza `InvalidTransitionError` y no altera el estado ni el historial

### R3: Registrar historial inmutable (RF-6.7)

Cada transición válida **DEBE** crear un registro en `state_change_history` con `contratacionId`, `estadoAnterior`, `estadoNuevo` y `timestamp`. El historial es append-only e inmutable y **DEBE** ser consultable por `contratacionId` para que el cliente y el prestador participantes accedan a su historial completo de cambios.

#### Escenario: Cadena completa de transiciones

- **Dado** una contratación que atraviesa solicitada → presupuestada → confirmada → en_curso → finalizada
- **Cuando** se consulta el historial por `contratacionId`
- **Entonces** se retornan los registros ordenados por `timestamp` ascendente
- **Y** cada registro contiene `estadoAnterior`, `estadoNuevo` y `timestamp` correctos
- **Y** el estado actual coincide con el `estadoNuevo` de la última fila (*finalizada*)

### R4: Autorización del consultante del historial

El historial solo puede ser consultado por un **participante** de la contratación (su cliente o su prestador). Un tercero no participante **DEBE** ser rechazado.

#### Escenario: Tercero intenta consultar el historial

- **Dado** un usuario autenticado que no es ni el cliente ni el prestador de la contratación
- **Cuando** solicita el historial por `contratacionId`
- **Entonces** el sistema rechaza el acceso y no expone los registros

### R5: Invocar notificación (UC19) post-transición — best-effort

Tras cada transición válida, el sistema **DEBE** invocar el puerto de notificaciones (UC19). Si UC19 falla, la transición **NO** se revierte.

#### Escenario: Notificación posterior a transición

- **Dado** una transición válida solicitada → presupuestada
- **Cuando** se aplica la transición exitosamente
- **Entonces** se invoca `INotificationService` con `contratacionId`, `estadoAnterior`, `estadoNuevo` y `timestamp`
- **Y** la contratación conserva el nuevo estado aunque la notificación falle

## Fuera de alcance

- Implementación de UC19 (notificaciones) — permanece como stub invocado best-effort.
- Endpoints REST y validación de payloads de cada caso de uso — responsabilidad de UC07/UC08/UC10/etc.
- Lógica de negocio específica de UC07, UC08, UC10, UC13, UC20, UC21 (esta spec solo valida la transición que cada uno solicita).
