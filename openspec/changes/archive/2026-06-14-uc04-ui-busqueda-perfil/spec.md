# Spec — MI-04.3 UI Búsqueda de prestadores + Perfil público (UC04)

**Trazabilidad:** UC04 Buscar prestadores · RF-2.1 (catálogo de 7 categorías del Anexo A) · RF-2.2 (filtro por zona de cobertura que contiene la ubicación del cliente) · RF-2.3 (ordenamiento por calificación, distancia y disponibilidad) · RF-2.5 (perfil público: servicios, calificación promedio y reseñas) · RNF-A.1 (>85% completitud al 1er intento) · RNF-A.2 (Chrome/Firefox/Safari últimas 2 versiones desktop+móvil) · RNF-A.3 (≤5 pasos contratación). Contrato backend: `GET /catalogo/prestadores`, `GET /catalogo/prestadores/:id` (ya implementados, verificados y mergeados).

---

## Propósito

Esta UI implementa la pantalla **pública** de búsqueda/listado de prestadores y la pantalla de **perfil público** de UC04 en el cliente Next.js (`client/`). Permite que un visitante **sin sesión** busque prestadores por oficio y ubicación, los filtre/ordene, recorra resultados paginados y consulte el perfil público de uno de ellos, consumiendo los endpoints ya construidos `GET /catalogo/prestadores` y `GET /catalogo/prestadores/:id`. El alcance es exclusivamente frontend: validación cliente, presentación de resultados/perfil, manejo de estados (loading, vacío, sin resultados, error) y mapeo de respuestas del backend (200, 400, 404, red/5xx). La lógica de búsqueda, geocoding, ranking y persistencia están **fuera de alcance** (UC04 backend, ya cerrado).

---

## Alcance

**En alcance:**
- Pantalla de búsqueda/listado `/prestadores`: barra con **Oficio** + **Ubicación** (ambos obligatorios) + filtros opcionales (orden, calificación mínima, fecha), resultados como grid/lista de cards `PrestadorResumen`, paginación.
- Estados explícitos: cargando (skeleton), sin resultados (diferenciado de error, incluye ubicación no resuelta), error (red/5xx reintentable), resultados.
- Pantalla de perfil público `/prestadores/:id`: `PrestadorPerfil` completo (oficios, calificación, zona de cobertura, servicios con rango de precio, reseñas), estado 404, estado id inválido.
- Acceso público sin sesión; navegable desde la landing y desde la nav pública.

**Fuera de alcance:** ver sección final. **Explícito:** solicitar/contratar al prestador es **UC07/UC08** (MI-07/MI-08) — esta WI solo expone un CTA "Solicitar" como punto de entrada placeholder, sin implementar el flujo.

---

## Requisitos

### REQ-01 — Barra de búsqueda: campos obligatorios y validación cliente

| Campo UI | Param backend | Obligatorio | Validación cliente |
|---|---|---|---|
| Oficio | `oficio` | Sí | Selección no vacía; combobox con las 7 categorías del catálogo (RF-2.1) |
| Ubicación | `ubicacion` | Sí | Texto no vacío |

> Los únicos filtros opcionales son **orden** y **calificación mínima** (ver REQ-02). El campo de **fecha** fue retirado (PA-06).

El sistema MUST exigir **oficio** y **ubicación** antes de disparar la búsqueda. Si falta alguno, el submit MUST bloquearse en cliente (sin solicitud HTTP) y mostrar error inline en el campo faltante. Esto previene el 400 del backend ("El oficio es obligatorio" / "La ubicación es obligatoria"). Los filtros opcionales nunca son requeridos.

### REQ-02 — Filtros y ordenamiento opcionales

El sistema MUST ofrecer filtros opcionales que se mapean a query params: orden (`orden`: `calificacion` default RN-CAT-03 | `distancia` | `disponibilidad`) y calificación mínima (`calificacionMin`: 1..5). El orden por defecto MUST ser "Calificación". Aplicar o cambiar un filtro/orden MUST re-ejecutar la búsqueda sin recarga de página completa y volver a `page=1`. El sistema MUST distinguir "Limpiar filtros" (vacía filtros adicionales, conserva oficio+ubicación) de "Restablecer" (vuelve a defaults: orden=calificación, page=1, pageSize=20). El sistema MUST NOT enviar params desconocidos (el backend usa whitelist y devolvería 400).

> **Cambio (UC04 fix):** el filtro **fecha de disponibilidad** (`fecha`) se **retira** de la UI y del plumbing de query params. El backend UC04 lo aceptaba pero nunca lo aplicaba (filtro muerto), y un filtrado por fecha real requiere la agenda del prestador (UC06), aún no construida. Se conserva el **ordenamiento por disponibilidad**, que sí funciona. Ver PA-06 en `openspec/specs/catalogo/spec.md`.

### REQ-03 — Card de resultado (PrestadorResumen)

Cada resultado MUST presentarse como card clickeable hacia el perfil, mostrando: nombre completo (`nombreCompleto`), oficios (`oficios[]`) como chips, calificación promedio (`calificacionPromedio`) con estrellas + texto + cantidad de reseñas (`cantidadResenas`), badge de disponibilidad (REQ-04) y distancia (`distanciaKm`) solo si está presente. La calificación MUST mostrarse con coma decimal es-AR (ej. "4,5") y SIEMPRE acompañada de texto accesible ("4,5 de 5, 12 reseñas").

### REQ-04 — Badge de disponibilidad semántico y accesible

El campo `disponibilidad` MUST mapearse a un badge con texto explícito y color de refuerzo (no color como único canal, WCAG 1.4.1):

| Valor backend | Etiqueta es-AR | Token color |
|---|---|---|
| `disponible_esta_semana` | "Disponible esta semana" | `accent-subtle` (verde) |
| `proxima_disponible` | "Próxima: {proximaFechaDisponible}" | `warning-subtle` (ámbar) |
| `sin_disponibilidad` | "Sin disponibilidad" | `surface-sunken` (gris) |
| `null` | sin badge (omitir) | — |

### REQ-05 — Estados de la pantalla de listado

El sistema MUST manejar cuatro estados observables y diferenciados:

- **Cargando:** skeletons que reflejan las cards (`aria-busy="true"`), sin spinner full-page.
- **Resultados:** grid/lista de cards + total ("32 prestadores") + paginación (REQ-06).
- **Sin resultados (200 con `data: []`):** estado de tono neutro (NO error), "No encontramos prestadores para *{oficio}* en *{ubicacion}*." + sugerencias accionables (cambiar oficio, ampliar ubicación, quitar filtros). El form permanece visible y editable. Este estado MUST cubrir también el caso de **ubicación no resuelta** (el geocoding falló → backend devuelve 200 con lista vacía), agregando una guía de revisar/precisar la ubicación.
- **Error (red/5xx):** mensaje honesto no técnico ("Algo salió mal de nuestro lado.") + botón "Reintentar", `role="alert"`. MUST NOT exponer trazas.

### REQ-06 — Paginación

Los resultados MUST paginarse usando `page`/`pageSize` (default 20) y mostrar el total (`total`). El `total` que envía el backend MUST ser la cantidad **real** de prestadores que satisfacen todos los criterios incluyendo el filtro de zona de cobertura (RN-CAT-06), no la longitud de la página actual; la UI lo usa para calcular la cantidad de páginas. El control MUST ser navegable por teclado, con la página actual marcada `aria-current="page"`. Cambiar de página MUST re-ejecutar la consulta sin recarga completa, preservando oficio, ubicación, filtros y orden vigentes.

### REQ-07 — Pantalla de perfil público (PrestadorPerfil)

`/prestadores/:id` MUST mostrar el perfil completo: nombre, oficios, calificación promedio (estrellas + texto), zona de cobertura (`zonaCobertura[]`), servicios (`servicios[]` con categoría, descripción y rango de precio `min`–`max`) y reseñas (`resenas[]` con calificación, contenido, fecha y nombre de cliente si está). El sistema MUST NOT mostrar datos de contacto (teléfono/email) — **RN-CAT-05**: el perfil público no los incluye y el backend no los expone.

### REQ-08 — CTA "Solicitar" como punto de entrada a UC07/UC08 (placeholder)

El perfil MUST exponer un CTA "Solicitar" claramente identificado como el punto de entrada al flujo de contratación. En esta WI el CTA es un **placeholder** marcado como dependencia de UC07/UC08 (MI-07/MI-08): puede deshabilitarse con tooltip, o navegar a `/login` si el flujo requiere sesión. El sistema MUST NOT implementar la creación de la contratación en esta WI.

### REQ-09 — Estado 404 e id inválido en perfil

Ante HTTP 404 ("Prestador no encontrado"), el sistema MUST mostrar una pantalla "Prestador no encontrado" con CTA "Volver a la búsqueda" (hacia `/prestadores`), sin tratarlo como error técnico. Ante HTTP 400 (id no es UUID v4), el sistema MUST comportarse como prestador inexistente (misma pantalla "no encontrado"), sin exponer detalles técnicos del backend.

### REQ-10 — Acceso público sin sesión

Ambas pantallas MUST ser accesibles sin sesión iniciada (precondición UC04: ninguna). MUST NOT redirigir a `/login` ni bloquear la consulta por ausencia de sesión. La nav pública MUST ofrecer el acceso a "Buscar" desde la landing.

### REQ-11 — Accesibilidad WCAG 2.1 AA

Cumple DESIGN-SYSTEM §8: campos de búsqueda con `<label>` visible y `aria-required="true"`; campos con error con `aria-invalid` + `aria-describedby`; contenedor en carga con `aria-busy="true"`; estado de error con `role="alert"`; calificación accesible por texto (no solo estrellas); badges con texto + ícono/punto (no solo color, WCAG 1.4.1); foco visible (`focus-visible`, ring 2px + offset 2px); orden de tabulación lógico; cards y paginación navegables por teclado; targets táctiles ≥44×44px; inputs `font-size ≥16px`; contraste ≥4.5:1 en claro/oscuro; `lang="es-AR"` en el documento raíz; decimales con coma es-AR.

### REQ-12 — Compatibilidad, responsive y flujo (RNF-A.2 / RNF-A.3)

Ambas pantallas MUST funcionar sin errores críticos en Chrome, Firefox y Safari (últimas 2 versiones, desktop + móvil Android/iOS). Layout responsive (DESIGN-SYSTEM §4.7 / §5.4): desktop con sidebar de filtros + grid; mobile con barra apilada y filtros en drawer/sheet. La búsqueda (1 acción) y la apertura de perfil (1 acción) MUST NOT exceder el presupuesto de ≤5 pasos del flujo de contratación.

---

## Escenarios

### ESC-UI-01 — Búsqueda exitosa con resultados (200 → cards + paginación)

**Satisface:** UC04 flujo básico, RF-2.2, RF-2.3, RN-CAT-03, REQ-01, REQ-03, REQ-05, REQ-06

```
Dado   un visitante sin sesión en /prestadores
Cuando selecciona un oficio, ingresa una ubicación válida y hace clic en "Buscar"
Entonces
  - el contenedor entra en estado de carga (skeletons, `aria-busy="true"`)
  - el backend responde 200 con { data:[...], total, page, pageSize }
  - se renderiza una card por prestador con nombre, oficios, calificación (estrellas + "4,5 de 5, N reseñas"),
    badge de disponibilidad y distancia si viene
  - se muestra el total ("32 prestadores") y la paginación (página actual con aria-current)
  - el orden por defecto es "Calificación" (RN-CAT-03)
```

### ESC-UI-02 — Validación cliente: oficio o ubicación faltante bloquea el submit

**Satisface:** UC04 ESC-07, REQ-01

```
Dado   un visitante en /prestadores
Cuando deja vacío el oficio o la ubicación e intenta hacer clic en "Buscar"
Entonces
  - el submit se bloquea en cliente (NO se realiza ninguna solicitud HTTP)
  - el campo faltante muestra borde `error`, ErrorText ("Elegí un oficio." / "Ingresá una ubicación.")
    con `aria-invalid="true"` y `aria-describedby` al id del error
  - el foco se mueve al primer campo faltante
```

### ESC-UI-03 — Sin resultados (200 con data vacía) vs. ubicación no resuelta

**Satisface:** UC04 flujo alternativo 2.1, REQ-05

```
Dado   un visitante que busca un oficio en una ubicación sin prestadores que la cubran
Cuando el backend responde 200 con { data: [], total: 0 }
Entonces
  - se muestra un estado de tono NEUTRO (no error):
    "No encontramos prestadores para {oficio} en {ubicacion}."
  - se ofrecen sugerencias accionables: cambiar oficio, ampliar/precisar la ubicación, quitar filtros
  - el formulario de búsqueda permanece visible y editable (el CDU se reanuda en ingreso de criterios)

Dado   el mismo estado vacío cuando la ubicación no pudo resolverse (geocoding falló → 200 con lista vacía)
Entonces
  - el estado vacío agrega una guía específica de revisar/precisar la ubicación ingresada
  - NO se presenta como error de sistema
```

### ESC-UI-04 — Cambio de orden/filtro re-ejecuta la búsqueda sin recarga

**Satisface:** UC04 RF-2.3, RN-CAT-03/04, REQ-02, REQ-06

```
Dado   un visitante con resultados visibles
Cuando cambia el orden a "Distancia" o aplica calificación mínima (calificacionMin)
Entonces
  - se re-ejecuta la búsqueda con el nuevo query param, sin recarga de página completa
  - la consulta vuelve a page=1 conservando oficio y ubicación
  - "Restablecer" devuelve orden=calificación, page=1, pageSize=20 y vacía los filtros
  - NUNCA se envían params desconocidos al backend (evita 400 por whitelist)
```

### ESC-UI-05 — Apertura de perfil público completo

**Satisface:** UC04 paso 5, RF-2.5, RN-CAT-05, REQ-07, REQ-08

```
Dado   un visitante que hace clic en una card de resultado
Cuando navega a /prestadores/:id y el backend responde 200 con PrestadorPerfil
Entonces
  - se muestran nombre, oficios, calificación (estrellas + texto), zona de cobertura,
    servicios (categoría, descripción, rango de precio min–max) y reseñas
  - NO se muestra ningún dato de contacto (teléfono/email) — RN-CAT-05
  - el CTA "Solicitar" está presente como punto de entrada a UC07/UC08 (placeholder, no crea contratación)
```

### ESC-UI-06 — Perfil inexistente o id inválido

**Satisface:** REQ-09

```
Dado   un visitante que abre /prestadores/:id
Cuando el backend responde 404 "Prestador no encontrado"
       (o 400 porque el id no es un UUID v4)
Entonces
  - se muestra la pantalla "Prestador no encontrado" con CTA "Volver a la búsqueda"
  - NO se presenta como error técnico ni se exponen detalles del backend
```

### ESC-UI-07 — Error de red / servidor en búsqueda o perfil

**Satisface:** REQ-05, REQ-11

```
Dado   un visitante que dispara una búsqueda o abre un perfil
Cuando ocurre un fallo de red o el backend responde 5xx
Entonces
  - aparece un estado de error (`role="alert"`): "Algo salió mal de nuestro lado." + botón "Reintentar"
  - el estado se distingue claramente de "sin resultados"
  - no se exponen trazas ni detalles internos
```

---

## Catálogo de mensajes (es-AR)

| Situación | Mensaje |
|---|---|
| oficio faltante (cliente) | "Elegí un oficio." |
| ubicación faltante (cliente) | "Ingresá una ubicación." |
| sin resultados | "No encontramos prestadores para {oficio} en {ubicacion}. Probá con otro oficio, ampliá la ubicación o quitá filtros." |
| ubicación no resuelta | "No pudimos ubicar esa zona. Revisá o precisá la ubicación e intentá de nuevo." |
| error red / 5xx | "Algo salió mal de nuestro lado. Intentá de nuevo." |
| perfil no encontrado (404/400) | "No encontramos este prestador. Volvé a la búsqueda." |
| disponible esta semana | "Disponible esta semana" |
| próxima disponibilidad | "Próxima: {fecha}" |
| sin disponibilidad | "Sin disponibilidad" |
| calificación accesible | "{valor} de 5, {N} reseñas" |

---

## Trazabilidad al contrato backend

| Endpoint | Respuesta | Requisito/Escenario UI |
|---|---|---|
| `GET /catalogo/prestadores` | 200 `PaginatedResult<PrestadorResumen>` | REQ-03, REQ-05, REQ-06 / ESC-UI-01 |
| `GET /catalogo/prestadores` | 200 `{ data:[], total:0 }` (sin resultados / geocoding falló) | REQ-05 / ESC-UI-03 |
| `GET /catalogo/prestadores` | 400 (falta oficio/ubicación o param desconocido) | REQ-01, REQ-02 / ESC-UI-02 (prevenido en cliente) |
| `GET /catalogo/prestadores?orden=…&calificacionMin=…` | 200 reordenado/filtrado | REQ-02 / ESC-UI-04 |
| `GET /catalogo/prestadores/:id` | 200 `PrestadorPerfil` | REQ-07, REQ-08 / ESC-UI-05 |
| `GET /catalogo/prestadores/:id` | 404 / 400 (id no UUID) | REQ-09 / ESC-UI-06 |
| cualquiera | red / 5xx | REQ-05 / ESC-UI-07 |

---

## Reglas de negocio (UI) aplicables

- **RN-CAT-03** — orden por defecto: calificación promedio DESC, desempate por cantidad de reseñas DESC (reflejado como default del selector de orden).
- **RN-CAT-04** — orden por disponibilidad: cantidad de franjas libres en próximos 7 días DESC (opción del selector).
- **RN-CAT-05** — el perfil público NO incluye datos de contacto; la UI no los muestra ni los solicita (REQ-07).

---

## Fuera de alcance

- **Solicitar/contratar al prestador (UC07/UC08, MI-07/MI-08):** esta WI solo expone el CTA "Solicitar" como placeholder/punto de entrada (REQ-08); el flujo de creación de contratación es otra WI.
- **Publicación de servicios y gestión de zona de cobertura (UC05/UC06):** lógica del prestador; esta WI solo consume los datos publicados.
- **Reseñas: creación/edición (RF-3.x):** la UI solo muestra reseñas existentes en el perfil; el alta de reseña es otro caso de uso.
- **Geocoding, ranking y filtrado por zona:** lógica del backend UC04 (ya implementada y verificada).
- **Mapa / visualización geográfica de resultados:** no requerido en esta iteración; la distancia se muestra como texto (`distanciaKm`).
- **Autenticación / sesión:** las pantallas son públicas (REQ-10); el manejo de sesión es UC02 (MI-02.2, ya cerrada).
