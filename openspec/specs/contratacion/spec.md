# Contratación (Spec)

## Propósito

Cubre el ciclo de **solicitud y respuesta** de una contratación de servicio entre un cliente y un prestador:

- **Solicitar (UC07):** un **cliente autenticado** solicita un servicio a un prestador indicando ubicación, prestador, fecha, franja horaria y descripción del problema. El sistema verifica la disponibilidad de la franja, la reserva de forma atómica y crea la contratación en estado **solicitada** vía la máquina de estados.
- **Responder (UC08):** el **prestador destino** envía una **propuesta** (fecha, franja y precio estimado de mano de obra) que lleva la contratación a **presupuestada**, o la **rechaza**, lo que la lleva a **cancelada**.

La gestión del grafo de estados, su validación y el historial de cambios **NO** son responsabilidad de esta capacidad: se delegan a la capacidad **state-machine** (UC09). Ver `../state-machine/spec.md` — esta spec solo invoca `transitionTo` con el destino correspondiente. El estado actual de una contratación se deriva de la última fila de `state_change_history` (RN-SM-06).

## Requisitos

### Trazabilidad funcional

| Código | Prioridad | Descripción normativa |
|--------|-----------|----------------------|
| RF-6.1 | Obligatorio | El cliente *deberá* poder enviar una solicitud indicando ubicación, prestador, fecha, franja y descripción. |
| RF-6.2 | Obligatorio | El prestador *deberá* poder aceptar, rechazar o proponer una alternativa a la solicitud recibida. |
| RF-6.3 | Obligatorio | El prestador *deberá* poder enviar al cliente un precio estimado de mano de obra (sin materiales ni repuestos). |
| RF-4.2 | Obligatorio | El sistema *deberá* bloquear franjas ya reservadas para evitar duplicación. |

### Trazabilidad no funcional

| Código | Aplicación |
|--------|-----------|
| RNF-S.1 | Solo un cliente autenticado (JWT rol `cliente`) puede crear una contratación; solo el prestador destino (JWT rol `prestador`) puede responderla. |
| RNF-S.4 | Los datos de la solicitud (ubicación, descripción) se tratan como datos personales; no se exponen a terceros no autorizados. |

### Reglas de negocio — Solicitud (UC07)

| ID | Regla |
|----|-------|
| RN-CON-01 | Solo un **cliente autenticado** (rol `cliente` en JWT) puede solicitar contratación. |
| RN-CON-02 | Campos obligatorios: **ubicación, prestador, fecha, franja horaria, descripción**. Sin ellos no se envía. |
| RN-CON-03 | La contratación se crea en estado **solicitada** invocando la máquina de estados (UC09). Esta capacidad no implementa el grafo de estados. |
| RN-CON-04 | La reserva de franja (vía módulo agenda/disponibilidad) y la creación de la contratación son **atómicas**: si falla una, no ocurre ninguna. |
| RN-CON-05 | El prestador destino debe estar **activo y visible** en el catálogo. |
| RN-CON-06 | La fecha debe ser **hoy o futura**. Una fecha pasada se rechaza. |

### Reglas de negocio — Respuesta del prestador (UC08)

| ID | Regla |
|----|-------|
| RN-CON-07 | Solo el **prestador destino** (`prestadorId`) puede responder. |
| RN-CON-08 | La contratación **DEBE** estar en `solicitada` para poder responderse. |
| RN-CON-09 | La propuesta requiere: **fecha ≥ hoy, franja, precioEstimado > 0**. |
| RN-CON-10 | El **rechazo** no requiere campos adicionales; se procesa con la sola intención → *cancelada*. |

## Escenarios (Given-When-Then)

### Solicitud (UC07)

#### ESC-01: Solicitud exitosa — flujo básico

- **Dado** un cliente autenticado que seleccionó un prestador con disponibilidad publicada
- **Cuando** completa ubicación, prestador, fecha, franja y descripción, y confirma
- **Entonces** el sistema valida los campos, verifica que la franja esté disponible, la reserva, invoca UC09 para crear la contratación en estado *solicitada*, y retorna HTTP 201 con los datos de la contratación

#### ESC-02: Campos obligatorios faltantes

- **Dado** un cliente autenticado que completa el formulario de solicitud
- **Cuando** omite al menos uno de los campos obligatorios y confirma
- **Entonces** el sistema rechaza el envío con HTTP 422 y una lista de los campos faltantes; no se crea contratación ni se reserva franja

#### ESC-03: Franja ya no disponible (RF-4.2)

- **Dado** un cliente autenticado que selecciona una franja que fue tomada entre la carga del formulario y la confirmación
- **Cuando** el sistema verifica la disponibilidad de la franja
- **Entonces** el sistema informa que la franja ya no está disponible con HTTP 409, ofrece elegir otra, y no crea la contratación

#### ESC-04: Cliente no autenticado

- **Dado** un usuario sin sesión activa (sin JWT o JWT inválido)
- **Cuando** intenta acceder al formulario de solicitud o enviar una
- **Entonces** el sistema rechaza con HTTP 401; no se procesa la solicitud

#### ESC-05: Prestador inactivo o inexistente

- **Dado** un cliente autenticado que selecciona un prestador
- **Cuando** el prestador fue suspendido, desactivado, o el ID no existe
- **Entonces** el sistema rechaza con HTTP 404 y no crea la contratación

#### ESC-06: Fecha en el pasado

- **Dado** un cliente autenticado
- **Cuando** selecciona una fecha anterior a la fecha actual
- **Entonces** el sistema rechaza con HTTP 422 indicando que la fecha debe ser hoy o futura

#### ESC-07: Falla en reserva de franja (rollback)

- **Dado** un cliente autenticado con datos válidos y franja disponible
- **Cuando** el sistema reserva la franja exitosamente pero la creación en UC09 falla (error de base de datos, timeout)
- **Entonces** el sistema **revierte** la reserva de la franja y retorna HTTP 500; no queda estado inconsistente

### Respuesta del prestador (UC08)

#### ESC-08: Propuesta exitosa con campos completos

- **Dado** un prestador autenticado (rol `prestador`) destino de una contratación en *solicitada*
- **Cuando** envía propuesta con fecha ≥ hoy, franja válida y precioEstimado > 0
- **Entonces** el sistema persiste la propuesta, invoca UC09 → *presupuestada* y retorna HTTP 200

#### ESC-09: Rechazo exitoso

- **Dado** un prestador autenticado destino de una contratación en *solicitada*
- **Cuando** selecciona rechazar sin enviar datos adicionales
- **Entonces** el sistema invoca UC09 → *cancelada* y retorna HTTP 200
- **Y** si el rechazo incluye campos extra (fecha, precio) el sistema los ignora y procesa el rechazo

#### ESC-10: Cliente intenta responder

- **Dado** un cliente autenticado
- **Cuando** intenta responder una contratación
- **Entonces** el sistema rechaza con HTTP 403

#### ESC-11: Prestador no destino intenta responder

- **Dado** un prestador autenticado cuyo ID no es el `prestadorId` de la contratación
- **Cuando** envía propuesta o rechazo
- **Entonces** el sistema rechaza con HTTP 404

#### ESC-12: Contratación ya no está en solicitada

- **Dado** un prestador autenticado destino
- **Cuando** la contratación ya no está en *solicitada* (p. ej. *presupuestada* o *cancelada*) y el prestador intenta responder
- **Entonces** UC09 rechaza la transición y el sistema retorna HTTP 409 indicando que la solicitud ya no puede responderse

#### ESC-13: precioEstimado faltante o inválido

- **Dado** un prestador autenticado destino
- **Cuando** envía propuesta sin precioEstimado o con valor ≤ 0
- **Entonces** el sistema rechaza con HTTP 422; precioEstimado debe ser > 0

#### ESC-14: Fecha de la propuesta en el pasado

- **Dado** un prestador autenticado destino
- **Cuando** envía propuesta con fecha anterior a hoy
- **Entonces** el sistema rechaza con HTTP 422

## Fuera de alcance

- **Gestión de estados** de la contratación (grafo de transiciones, validación, historial) — capacidad **state-machine** / UC09. Esta capacidad solo invoca `transitionTo`.
- **Notificación** a las partes — UC19 (se dispara desde UC09 al cambiar el estado).
- **Aceptación de la propuesta** por el cliente — UC21.
- **Cancelación** de contratación — UC10.
- **Gestión de agenda y disponibilidad** del prestador y validación de la franja/fecha propuesta — UC06.
- **Modificación** de una propuesta ya enviada.

## Preguntas abiertas / supuestos

| ID | Estado | Resolución |
|----|--------|-----------|
| PC-01 | Supuesto | **Reserva atómica:** se asume que el puerto de agenda/disponibilidad soporta reserva transaccional con rollback. → RN-CON-04. |
| PC-02 | Supuesto | **Identidad del prestador:** el cliente selecciona al prestador por su ID desde el catálogo (UC04). El sistema valida existencia y estado activo. → RN-CON-05. |
| PC-03 | Supuesto | **Ubicación como texto libre** (dirección escrita por el cliente). Sin geocodificación en esta iteración. |
