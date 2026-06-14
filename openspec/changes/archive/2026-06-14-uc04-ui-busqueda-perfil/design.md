# Design — MI-04.3 UI Búsqueda de prestadores + Perfil público (UC04)

> **Fase:** Diseño (SDD 1.2). Deriva del `spec.md` aprobado, del `client/DESIGN-SYSTEM.md` (fuente única
> de diseño) y de los **precedentes directos** `uc01-ui-registro/design.md` y `uc02-ui-login/design.md`
> (base compartida ya implementada y mergeada: tokens, fuentes, theme, primitivas `components/ui/*`,
> patrón `*-Result` discriminado en `lib/api/*`, `lib/copy/es-AR.ts`, `lib/validation/*`, `SessionProvider`/
> `useSession()`). Define el CÓMO arquitectónico. NO contiene código de producción: solo firmas, tipos y
> estructura prescriptiva para que el agente de Implementación no tenga ambigüedad.
>
> **Stack verificado (igual que UC01/UC02):** Next.js 16.2.9 (App Router) · React 19.2.4 · Tailwind v4
> (`@tailwindcss/postcss`, CSS-native `@theme { }`) · TS strict · alias `@/*` → `client/` ·
> `output: "standalone"` · RHF 7.79 + zod 4.4 + `@hookform/resolvers` (YA instalados) · vitest 4.1 (unit) ·
> Playwright 1.60 (E2E). Breaking Next 16: `params`/`searchParams` son **Promises** (se hace `await`);
> Server Components por defecto, `'use client'` solo para estado/handlers/effects. **`AGENTS.md` del client
> advierte: esta NO es la Next.js de tu training data → leer `node_modules/next/dist/docs/` antes de codear.**
>
> **Trazabilidad:** UC04 · RF-2.1 · RF-2.2 · RF-2.3 · RF-2.5 · RNF-A.1/A.2/A.3 · spec REQ-01..REQ-12 ·
> ESC-UI-01..07 · RN-CAT-03/04/05.

---

## 0. Continuidad con la base UC01/UC02 (qué se reutiliza, qué se agrega)

UC04 es la **primera pantalla pública de datos** (no de cuenta) y la primera que **lee del backend con
GET** y **renderiza SSR**. NO re-crea la base compartida: la consume y la extiende.

| Activo de la base existente | Uso en UC04 |
|---|---|
| `app/globals.css`, `app/layout.tsx`, tokens `@theme`, `theme-provider` | reutilizados sin cambios |
| `components/ui/{button,input,label,field,alert,select}` | **reutilizados** (filtros, estados, CTA, errores inline) |
| Patrón `*-Result` discriminado (`RegisterResult`/`LoginResult` en `lib/api/auth.ts`, **nunca throw** para 4xx) | **espejado** en `lib/api/catalogo.ts` (`buscarPrestadores`/`obtenerPerfil`) |
| `lib/copy/es-AR.ts` | **extendido** (no reescrito): nueva sección `copy.catalogo` |
| `lib/validation/*` (patrón zod + mensajes desde `copy`) | **extendido**: nuevo `lib/validation/busqueda.ts` |
| `SessionProvider`/`useSession()` (estado `{status, user?}` hidratado server-side) | **reutilizado solo de lectura** en la nav pública (no afecta la pantalla; ver ADR-04-05) |
| Transporte same-origin `/api/...` (rewrite ciego en `next.config.ts` → backend) | **reutilizado**: GET público, NO necesita Route Handler ni cookie |

**La diferencia estructural respecto a UC01/UC02:** aquellos eran *forms que escriben* (POST, estado en el
form, sin SSR de datos). UC04 es una *vista que lee y lista* (GET, paginada, filtrable, bookmarkeable). Esto
introduce dos piezas que la base no tenía: **(a) estado de búsqueda como fuente de verdad en la URL**
(searchParams) renderizado server-side, y **(b) un cliente HTTP de lectura server-side**. Ambas se resuelven
con ADRs explícitos (§2). NO se introduce ninguna librería nueva (sin React Query / SWR — ver ADR-04-02).

---

## 1. Arquitectura de carpetas

```
client/
├─ app/
│  └─ prestadores/                     # [NUEVO] segmento PÚBLICO (sin route group, URL real /prestadores).
│     ├─ page.tsx                       # [NUEVO] Server Component. Listado. await searchParams → valida →
│     │                                 #   buscarPrestadores() server-side → renderiza barra + resultados.
│     │                                 #   Suspense boundary con <ResultadosSkeleton/> como fallback. FEATURE.
│     ├─ loading.tsx                    # [NUEVO] streaming UI de Next: skeleton mientras el RSC re-fetch-ea
│     │                                 #   (REQ-05 cargando). Reusa <ResultadosSkeleton/>. FEATURE.
│     └─ [id]/
│        └─ page.tsx                    # [NUEVO] Server Component. Perfil. await params.id → obtenerPerfil()
│                                       #   server-side → 200 render perfil | 404/400 → <PerfilNoEncontrado/>.
│                                       #   notFound() de Next para 404 semántico. FEATURE.
│
├─ components/
│  └─ catalogo/                         # [NUEVO] feature por dominio "catalogo" (espejo de components/cuentas).
│     ├─ barra-busqueda.tsx             # [NUEVO] 'use client'. CORAZÓN del filtro: RHF+zod (oficio+ubicacion
│     │                                 #   obligatorios), filtros opcionales, submit → router.push(querystring).
│     │                                 #   Hidrata sus defaults desde los searchParams actuales (props). FEATURE.
│     ├─ filtros-panel.tsx              # [NUEVO] 'use client'. orden/calificacionMin/fecha + "Limpiar filtros"
│     │                                 #   y "Restablecer". Sidebar en desktop, sheet/drawer en mobile (REQ-12).
│     ├─ resultados-lista.tsx           # [NUEVO] Server Component. Grid responsive de <PrestadorCard/> + total +
│     │                                 #   <Paginacion/>. Recibe data ya resuelta por page.tsx (sin fetch). FEATURE.
│     ├─ prestador-card.tsx             # [NUEVO] Server Component. Card de PrestadorResumen (REQ-03): nombre,
│     │                                 #   chips de oficios, <RatingDisplay/>, <DisponibilidadBadge/>, distancia.
│     │                                 #   Es un <Link> a /prestadores/:id (navegable por teclado). FEATURE.
│     ├─ rating-display.tsx             # [NUEVO] Server Component. Estrellas (decorativas aria-hidden) + texto
│     │                                 #   accesible "4,5 de 5, N reseñas" (REQ-03/REQ-11). FEATURE.
│     ├─ disponibilidad-badge.tsx       # [NUEVO] Server Component. Mapea disponibilidad→{label,token,ícono}
│     │                                 #   (REQ-04). Texto + ícono/punto, NO solo color (WCAG 1.4.1). FEATURE.
│     ├─ paginacion.tsx                 # [NUEVO] 'use client' (o Server con <Link>): controles page/pageSize,
│     │                                 #   aria-current="page", preserva query vigente (REQ-06). FEATURE.
│     ├─ resultados-skeleton.tsx        # [NUEVO] skeleton de N cards, aria-busy="true" (REQ-05). FEATURE.
│     ├─ estado-vacio.tsx               # [NUEVO] Server Component. "sin resultados" NEUTRO + sugerencias;
│     │                                 #   variante "ubicación no resuelta" (REQ-05 / ESC-UI-03). FEATURE.
│     ├─ estado-error.tsx               # [NUEVO] 'use client'. role="alert" + botón "Reintentar"
│     │                                 #   (router.refresh()). REQ-05 / ESC-UI-07. FEATURE.
│     └─ perfil/
│        ├─ perfil-prestador.tsx        # [NUEVO] Server Component. Encabezado (nombre, oficios, rating),
│        │                              #   zona de cobertura, lista de servicios, lista de reseñas. REQ-07.
│        ├─ servicio-item.tsx           # [NUEVO] Server Component. categoría + descripción + rango precio min–max.
│        ├─ resena-item.tsx             # [NUEVO] Server Component. rating + contenido + fecha + clienteNombre?.
│        ├─ solicitar-cta.tsx           # [NUEVO] 'use client'. CTA "Solicitar" placeholder UC07/08 (ADR-04-06).
│        └─ perfil-no-encontrado.tsx    # [NUEVO] Server Component. "No encontramos este prestador" + CTA
│                                       #   "Volver a la búsqueda" → /prestadores. REQ-09 / ESC-UI-06.
│
├─ lib/
│  ├─ api/
│  │  └─ catalogo.ts                    # [NUEVO] buscarPrestadores(criterios) / obtenerPerfil(id) →
│  │                                    #   resultados discriminados (espejo del patrón auth.ts). Server-safe.
│  ├─ catalogo/
│  │  ├─ tipos.ts                       # [NUEVO] PrestadorResumen, PrestadorPerfil, Disponibilidad,
│  │  │                                 #   PaginatedResult<T>, CriteriosBusqueda — mirror EXACTO del contrato.
│  │  ├─ disponibilidad.ts              # [NUEVO] mapDisponibilidad(valor) → {label,token,icono} (función pura).
│  │  ├─ rating.ts                      # [NUEVO] formatRating(valor) (coma es-AR) + ratingAccesible(valor,N).
│  │  ├─ query-params.ts               # [NUEVO] criteriosFromSearchParams / criteriosToQueryString +
│  │  │                                 #   whitelist (NUNCA emite params desconocidos, REQ-02). Función pura.
│  │  └─ oficios.ts                     # [NUEVO] catálogo estático de las 7 categorías (RF-2.1). Ver Supuesto S2.
│  ├─ copy/
│  │  └─ es-AR.ts                       # [EXTENDIDO] + sección copy.catalogo (labels, estados, mensajes).
│  └─ validation/
│     └─ busqueda.ts                    # [NUEVO] schema zod: oficio (enum 7 categorías) + ubicacion no-vacíos.
│
└─ e2e/
   └─ prestadores.spec.ts               # [NUEVO] placeholder ESC-UI-01..07 (los tests los escribe el Verificador).
```

**Convención de capas (DESIGN-SYSTEM §10.1) respetada e idéntica a UC01/UC02:** tokens → `globals.css`;
primitivas → `components/ui/*`; compuestos/feature → `components/catalogo/*`; lógica no-visual → `lib/*`;
pantallas → `app/prestadores/*`. **Sin Route Handler ni middleware:** la pantalla es pública (REQ-10) y el
GET viaja por el rewrite ciego ya existente.

**Por qué `app/prestadores/` (no un route group `(publico)`):** estas rutas SÍ son segmentos de URL reales
(`/prestadores`, `/prestadores/:id`), a diferencia de `(auth)` que agrupaba sin aportar URL. Confirma la ruta
propuesta en la spec (REQ-10 / §"Ruta es-AR"). **Decisión: ruta `/prestadores` confirmada**, no `/buscar`:
es el recurso (un listado de prestadores), el perfil cuelga naturalmente como `/prestadores/:id`, y es la
ruta que `middleware.ts` ya deja pública (UC02 Supuesto S3).

---

## 2. Decisiones arquitectónicas (ADRs)

### ADR-04-01 — Estado de búsqueda + rendering: **Server Component que lee `searchParams` (URL = fuente de verdad)** [CENTRAL]

Es la decisión más importante del diseño: define el modelo de datos de toda pantalla de listado/filtro futura.

- **Decisión:** la fuente de verdad de la búsqueda son los **query params de la URL**
  (`/prestadores?oficio=…&ubicacion=…&orden=…&page=…`). `app/prestadores/page.tsx` es un **Server Component**
  que hace `await searchParams`, los valida/normaliza (`criteriosFromSearchParams`) y llama
  `buscarPrestadores()` **server-side**; el HTML llega ya con los resultados. La `<BarraBusqueda/>` y la
  `<Paginacion/>` (client components) NO guardan estado de resultados: al submit/cambio hacen
  `router.push('/prestadores?' + nuevoQueryString)` → Next re-renderiza el RSC con los nuevos criterios. El
  estado de carga lo provee `app/prestadores/loading.tsx` (streaming UI de Next) mientras el RSC re-fetchea.
- **Por qué (concreto, no estético):**
  - **Bookmarkeable / compartible / back-button correcto:** una búsqueda es una URL. Copiar el link reproduce
    exactamente los mismos resultados; el botón "atrás" navega entre búsquedas sin estado fantasma. Imposible
    de garantizar con estado en memoria del cliente.
  - **SSR-friendly, sin flash:** el primer render ya trae resultados (mejor LCP, RNF-A.1 completitud al 1er
    intento). No hay "spinner → fetch en cliente → pintar" (el patrón parpadeante de la opción B).
  - **El token nunca hace falta:** GET público → el fetch corre server-side contra el backend vía proxy. No
    se expone `fetch` de datos al bundle del navegador (menos JS, menos superficie).
  - **Paginación/filtros triviales y consistentes:** cada control solo edita el querystring; `page=1` al
    cambiar filtros (REQ-02) es una regla pura sobre la URL, no sincronización de estado.
- **Tradeoffs aceptados y cómo se mitigan:**
  - **Cada cambio de filtro es una navegación (round-trip server), no una mutación in-place.** Para una
    búsqueda con geocoding+ranking en el backend esto es lo correcto (los datos viven en el server, no se
    pueden filtrar en cliente). **Mitigación de UX:** `loading.tsx` + Suspense dan feedback inmediato
    (skeletons, `aria-busy`) sin recarga de página completa (REQ-02/REQ-06 "sin recarga completa" se cumple:
    `router.push` es navegación cliente del App Router, no full reload). La barra puede marcar
    `useTransition` para mantener los resultados previos visibles mientras llega el siguiente set.
  - **Interactividad de filtros más "pesada" que estado local.** Aceptado: los filtros del backend NO son
    filtrables en cliente (dependen de geocoding/ranking server). Un estado client sería una mentira (habría
    que refetchear igual). La URL es honesta sobre eso.
  - **`searchParams` es Promise (Next 16).** Se hace `await` en el RSC; los client components reciben los
    valores ya resueltos como props (mismo patrón que `login/page.tsx` con `next`).
- **Recomendación fundada:** **opción (A) SSR + URL-state.** Es el patrón canónico de App Router para
  listados con datos del servidor, da búsqueda compartible y sin flash, y NO agrega dependencias.
- **Alternativa rechazada — (B) Client Component con `useState`/`useEffect` + fetch en cliente
  (o React Query/SWR):** rechazada porque (1) la búsqueda dejaría de ser bookmarkeable/compartible (estado en
  memoria, URL muda); (2) flash obligado (render vacío → fetch → pintar) que daña RNF-A.1 y LCP; (3) mueve el
  fetch de datos al bundle del cliente sin beneficio (no hay interacción optimista que justifique cache
  client-side en una búsqueda server-ranked); (4) agregar React Query/SWR sería **sobre-ingeniería** para dos
  GET de lectura sin mutaciones ni cache compartida — contradice el principio de no introducir libs sin
  necesidad (precedente UC01/UC02). El único caso donde (B) ganaría (filtrado puramente client-side de un
  dataset ya descargado) NO aplica: el backend hace geocoding+ranking.

> **Impacto observable resumido (para el gate humano):** la búsqueda vive en la URL; el Server Component la
> lee, valida y fetchea server-side; cambiar oficio/filtro/orden/página hace `router.push` del nuevo
> querystring y Next re-renderiza con skeletons via `loading.tsx` (sin recarga completa, sin flash). Las
> búsquedas son compartibles y el back-button funciona. Cero deps nuevas.

### ADR-04-02 — Dónde vive el fetch: **`buscarPrestadores`/`obtenerPerfil` server-side, mismo patrón discriminado que auth**

- **Decisión:** `lib/api/catalogo.ts` expone `buscarPrestadores(criterios)` y `obtenerPerfil(id)` que
  devuelven **resultados discriminados** `{ok:true,data} | {ok:false,kind}` — **idéntico contrato mental a
  `registerUser`/`loginUser`, nunca lanzan para 4xx**. La diferencia con auth: estas funciones se invocan
  **desde el Server Component** (corren en el servidor de Next), no desde un client form. Por eso hacen
  `fetch` con **URL absoluta al backend** (`BACKEND_URL`, server-only env ya usado por el rewrite), NO la
  ruta relativa `/api/...` (el rewrite relativo no resuelve fuera del navegador). El handler de error y la
  forma del resultado son las mismas que el precedente.
- **Por qué:** consistencia total con el patrón establecido (el Verificador ya razona en `{ok, kind}` y mocks
  de `fetch`). Mantener el resultado discriminado permite que el RSC mapee `kind` → componente de estado
  (`<EstadoVacio/>`, `<EstadoError/>`, `<PerfilNoEncontrado/>`) de forma pura y testeable, sin try/catch
  disperso. Server-side fetch evita exponer datos/latencia al cliente y aprovecha el render SSR (ADR-04-01).
- **Resolución del transporte (CRÍTICO para el implementador):** en Server Components NO hay origen relativo;
  hay que apuntar al backend directo. `buscarPrestadores`/`obtenerPerfil` leen `process.env.BACKEND_URL ??
  "http://localhost:3000"` (mismo valor que el rewrite de `next.config.ts`) y hacen
  `fetch(BACKEND_URL + "/catalogo/prestadores?" + qs)`. **No** se enruta por `/api/...` server-side. Se setea
  `cache: "no-store"` (datos dinámicos por query) — la búsqueda no se cachea entre usuarios.
- **Alternativa rechazada — reusar la ruta relativa `/api/catalogo/...`:** funciona en el navegador pero NO
  server-side (un Server Component no tiene base de origen para `/api/...`). Forzarlo (construir el origen
  absoluto del propio Next) agregaría un hop inútil (Next→Next→backend) sin beneficio. El fetch directo al
  backend desde el RSC es más simple y rápido. (Si en el futuro un componente client necesitara refetchear,
  ahí sí usaría `/api/catalogo/...` por el rewrite — pero ADR-04-01 evita ese caso.)

### ADR-04-03 — Validación oficio+ubicacion obligatorios: **zod en cliente (bloquea submit) + guarda en el RSC (no fetch sin criterios)**

- **Decisión:** doble barrera para no pegarle al backend con 400 (REQ-01):
  1. **Cliente (`lib/validation/busqueda.ts` + `<BarraBusqueda/>`):** zod con `oficio` (enum de las 7
     categorías de `lib/catalogo/oficios.ts`, RF-2.1) y `ubicacion` (string no-vacío). Si falta alguno, el
     submit se bloquea (sin `router.push`), se muestra error inline (`aria-invalid` + `aria-describedby`,
     `field.tsx`) y el foco va al primer campo faltante (ESC-UI-02).
  2. **Server Component (`page.tsx`):** ante `searchParams` sin `oficio` o sin `ubicacion` (ej. alguien entra
     a `/prestadores` directo, sin querystring), **NO llama a `buscarPrestadores`**: renderiza la barra vacía
     + un estado inicial neutro ("Buscá un oficio en tu zona") — el primer ingreso al CDU. Esto evita el 400
     y cubre el deep-link incompleto.
- **Por qué:** el cliente da feedback inmediato (REQ-01/ESC-UI-02) y el guard del RSC garantiza el invariante
  aunque alguien manipule la URL. La whitelist de `query-params.ts` (REQ-02) asegura que NUNCA se serialice
  un param desconocido (el backend usa `forbidNonWhitelisted` → 400). Validar en ambas capas es el mismo
  principio "cliente complementa, server es la verdad" de UC01 (RN-REG-03).
- **Alternativa rechazada — validar solo en cliente:** dejaría el deep-link `/prestadores` (sin params) sin
  manejo → fetch con criterios vacíos → 400 visible. Rechazada.

### ADR-04-04 — Estado vacío vs error: **se distingue en la capa de datos por HTTP status, no por contenido**

- **Decisión:** la distinción "sin resultados" vs "error real" se decide por el **status HTTP**, no por
  inspeccionar el body. `buscarPrestadores` mapea:
  - **200 con `data: []` (incluye geocoding fallido)** → `{ok:true, data:{data:[], total:0, …}}`. El RSC, al
    ver `ok:true && total===0`, renderiza `<EstadoVacio/>` (tono NEUTRO, NO error) — REQ-05/ESC-UI-03.
  - **red / 5xx / body inválido** → `{ok:false, kind:'network'|'server'}`. El RSC renderiza `<EstadoError/>`
    (`role="alert"` + "Reintentar") — REQ-05/ESC-UI-07.
  - **400** → `{ok:false, kind:'bad_request'}` — NO debería ocurrir (el cliente+guard lo previenen, ADR-04-03);
    si ocurre, se trata como error de sistema neutro (no se exponen detalles del backend).
- **Distinción geocoding-fail vs sin-resultados dentro del estado vacío:** el backend devuelve 200 `data:[]`
  en **ambos** casos y NO marca cuál fue (verificado en spec). La UI **no puede distinguirlos por la
  respuesta**, así que `<EstadoVacio/>` muestra el mensaje base ("No encontramos prestadores para {oficio} en
  {ubicacion}…") **y siempre** incluye la guía de ubicación ("Si no aparece nada, revisá o precisá la
  ubicación") como sugerencia accionable. **Supuesto S4:** no se intenta inferir geocoding-fail; se ofrece la
  guía de ubicación como una de las sugerencias del estado vacío (cubre ambos casos sin falsos diagnósticos).
- **Por qué:** decidir por status (no por heurística sobre el body) es robusto y testeable (un mock por
  status → un estado). Evita el anti-patrón de tratar `data:[]` como error o un 500 como "vacío".
- **Alternativa rechazada — pedir al backend un flag `ubicacionResuelta`:** fuera de alcance (backend
  cerrado) y no disponible en el contrato. Se diseña con lo que el contrato garantiza.

### ADR-04-05 — Accesibilidad de rating y disponibilidad: **texto siempre presente, color/ícono como refuerzo (no único canal)**

- **Decisión (rating, REQ-03/REQ-11):** `<RatingDisplay/>` renderiza las estrellas como **decorativas**
  (`aria-hidden="true"`) y un texto accesible SIEMPRE presente: `"{valor} de 5, {N} reseñas"` con `valor`
  formateado en **coma decimal es-AR** (`formatRating(4.5) === "4,5"`). El lector de pantalla nunca depende
  de contar estrellas. Funciones puras en `lib/catalogo/rating.ts` (testeables).
- **Decisión (disponibilidad, REQ-04/WCAG 1.4.1):** `<DisponibilidadBadge/>` usa `mapDisponibilidad(valor)`
  (`lib/catalogo/disponibilidad.ts`, pura) → `{label, token, icono}`. El badge SIEMPRE lleva **texto + un
  ícono/punto**; el color (`accent-subtle`/`warning-subtle`/`surface-sunken`) es **refuerzo**, no el único
  canal. `null` → **se omite el badge** (no se renderiza "sin dato"). Mapa:

  | valor backend | label es-AR | token | ícono |
  |---|---|---|---|
  | `disponible_esta_semana` | "Disponible esta semana" | `accent-subtle` | check / punto verde |
  | `proxima_disponible` | "Próxima: {proximaFechaDisponible}" | `warning-subtle` | reloj / punto ámbar |
  | `sin_disponibilidad` | "Sin disponibilidad" | `surface-sunken` | guion / punto gris |
  | `null` | — (omitir) | — | — |
- **Por qué:** WCAG 1.4.1 prohíbe el color como único portador de significado; texto + ícono lo garantiza en
  claro y oscuro. La coma decimal es-AR es requisito explícito (REQ-03/REQ-11). Aislar el mapeo en funciones
  puras lo hace verificable sin DOM.
- **Sobre `useSession()` en la nav pública:** la pantalla es pública (REQ-10) y NO depende de sesión. La nav
  global puede leer `useSession()` (ya existente) para mostrar "Ingresá" vs nombre/logout — eso es de la
  base, NO se diseña acá ni condiciona el render del listado/perfil.

### ADR-04-06 — CTA "Solicitar": **placeholder visible + redirect a `/login?next=` (no deshabilitado mudo)**

- **Decisión:** el CTA "Solicitar" del perfil (`<SolicitarCta/>`, `'use client'`) está **presente y visible**
  (no oculto), marcado como punto de entrada al flujo de contratación. En esta WI **no crea contratación**
  (REQ-08): al hacer click navega a `/login?next=/prestadores/{id}` si no hay sesión (reusa el patrón `next`
  de UC02), o muestra un aviso "Próximamente" si ya hay sesión (UC07/08 aún no existen). Lleva un atributo/
  comentario `data-feature="uc07-uc08"` para trazar la dependencia.
- **Por qué:** un botón deshabilitado-mudo es peor UX y peor a11y (no comunica el porqué). Redirigir a login
  es el primer paso real del futuro flujo (la contratación requerirá sesión) y reutiliza infra existente sin
  acoplar a UC07/08. **Supuesto S5:** el destino exacto post-login lo definirá UC07/08; acá el CTA solo
  encamina, no implementa.
- **Alternativa considerada — deshabilitado + tooltip:** aceptable pero comunica menos. Se elige redirect por
  reaprovechar `next` y dejar el camino abierto. A confirmar en HITL.

---

## 3. HTTP client — firmas y tipos (mirror EXACTO del contrato)

`lib/api/catalogo.ts` (NUEVO). Transporte: **fetch server-side a `BACKEND_URL` directo** (ADR-04-02), NO el
rewrite relativo. Tipos en `lib/catalogo/tipos.ts`.

```ts
// lib/catalogo/tipos.ts  (mirror EXACTO del contrato backend)

export type Disponibilidad =
  | "disponible_esta_semana"
  | "proxima_disponible"
  | "sin_disponibilidad";

export interface PrestadorResumen {
  id: string;
  nombreCompleto: string;
  oficios: string[];
  calificacionPromedio: number;
  cantidadResenas: number;
  disponibilidad: Disponibilidad | null;
  proximaFechaDisponible?: string;
  franjasDisponiblesProximos7Dias?: number;
  distanciaKm?: number;
  centroCobertura?: string;
}

export interface RangoPrecio { min: number; max: number; }
export interface Servicio {
  id: string;
  categoria: string;
  descripcion: string;
  rangoPrecio: RangoPrecio;
}
export interface Resena {
  calificacion: number;
  contenido: string;
  fecha: string;
  clienteNombre?: string;
}
export interface PrestadorPerfil {
  id: string;
  nombreCompleto: string;
  oficios: string[];
  calificacionPromedio: number;
  cantidadResenas: number;
  zonaCobertura: string[];
  servicios: Servicio[];
  resenas: Resena[];
  // RN-CAT-05: SIN datos de contacto. El tipo NO declara teléfono/email.
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type Orden = "calificacion" | "distancia" | "disponibilidad";

// Criterios ya validados/normalizados (oficio+ubicacion garantizados no vacíos).
export interface CriteriosBusqueda {
  oficio: string;
  ubicacion: string;
  orden?: Orden;            // default 'calificacion' (RN-CAT-03)
  calificacionMin?: number; // 1..5
  fecha?: string;
  page?: number;            // default 1
  pageSize?: number;        // default 20
}
```

```ts
// lib/api/catalogo.ts  (firmas ilustrativas, NO implementación)

// Resultado discriminado de búsqueda — espejo de RegisterResult/LoginResult. Nunca lanza para 4xx.
export type BuscarResult =
  | { ok: true; data: PaginatedResult<PrestadorResumen> } // 200 (incluye data:[] / geocoding-fail)
  | { ok: false; kind: "bad_request" }                    // 400 (no debería ocurrir; guard ADR-04-03)
  | { ok: false; kind: "network" }                        // transporte falló
  | { ok: false; kind: "server"; status: number };        // 5xx / body inválido / inesperado

// Corre SERVER-SIDE (Server Component). fetch(BACKEND_URL + "/catalogo/prestadores?" + qs), no-store.
export declare function buscarPrestadores(criterios: CriteriosBusqueda): Promise<BuscarResult>;

// Resultado discriminado de perfil. 400(uuid inválido) y 404 colapsan a 'not_found' (REQ-09).
export type PerfilResult =
  | { ok: true; data: PrestadorPerfil }      // 200
  | { ok: false; kind: "not_found" }         // 404 o 400 (id no UUID) → misma pantalla
  | { ok: false; kind: "network" }
  | { ok: false; kind: "server"; status: number };

export declare function obtenerPerfil(id: string): Promise<PerfilResult>;
```

Notas de mapeo de status (misma filosofía que `auth.ts`, reutiliza el helper `safeJson` por copia o
extracción a `lib/http`):
- `buscarPrestadores`: 200→`{ok:true,data}` (validar forma mínima `{data,total,page,pageSize}`; si falta →
  `server`) · 400→`bad_request` · 5xx/otro→`server` · throw transporte→`network`.
- `obtenerPerfil`: 200→`{ok:true,data}` · **404 o 400→`not_found`** (colapso deliberado, REQ-09; el 400 por
  uuid inválido se trata como inexistente, sin exponer el detalle) · 5xx/otro→`server` · throw→`network`.

---

## 4. Construcción y parseo de query (whitelist) — `lib/catalogo/query-params.ts`

Funciones **puras** (sin DOM, sin fetch) — el corazón testeable del URL-state (ADR-04-01/03).

```ts
// searchParams (ya await-eados) → CriteriosBusqueda normalizados. Ignora claves desconocidas
// y valores inválidos (orden fuera del enum, calificacionMin fuera de 1..5, page<1). NUNCA throw.
declare function criteriosFromSearchParams(
  sp: Record<string, string | string[] | undefined>,
): Partial<CriteriosBusqueda>;   // oficio/ubicacion pueden faltar → el guard del RSC decide (ADR-04-03)

// CriteriosBusqueda → querystring SOLO con claves whitelisteadas y valores definidos.
// Garantiza REQ-02: jamás emite un param desconocido (evita 400 por forbidNonWhitelisted).
declare function criteriosToQueryString(c: CriteriosBusqueda): string;

// Helpers de reglas de UI sobre la URL (REQ-02):
declare function withFiltroAplicado(c: CriteriosBusqueda, patch: Partial<CriteriosBusqueda>): CriteriosBusqueda; // resetea page=1
declare function limpiarFiltros(c: CriteriosBusqueda): CriteriosBusqueda; // conserva oficio+ubicacion, borra orden/calificacionMin/fecha, page=1
declare function restablecer(c: CriteriosBusqueda): CriteriosBusqueda;    // orden='calificacion', page=1, pageSize=20, borra filtros
```

**Whitelist (única fuente):** `['oficio','ubicacion','orden','calificacionMin','fecha','page','pageSize']`.
Cualquier clave fuera de esa lista se descarta en ambas direcciones. El orden por defecto materializado es
`calificacion` (RN-CAT-03); el selector lo muestra preseleccionado.

---

## 5. State & validation

### 5.1 Barra de búsqueda (`barra-busqueda.tsx`, `'use client'`)

```ts
interface BusquedaFormValues { oficio: string; ubicacion: string; }
// Props: { defaults: Partial<BusquedaFormValues>, filtros: Partial<CriteriosBusqueda> }
//   (vienen de los searchParams resueltos en page.tsx → la barra hidrata su estado inicial desde la URL).
// Estado UI extra: isPending (useTransition, para no congelar al navegar — ADR-04-01).
```

Reglas zod (`lib/validation/busqueda.ts`) — mensajes desde `copy.catalogo`:

| Campo | Regla cliente | Mensaje (catálogo) |
|---|---|---|
| `oficio` | enum de las 7 categorías (`oficios.ts`), no vacío | `copy.catalogo.errors.oficioRequerido` ("Elegí un oficio.") |
| `ubicacion` | string `trim().min(1)` | `copy.catalogo.errors.ubicacionRequerida` ("Ingresá una ubicación.") |

- **Trigger:** RHF `mode:'onBlur'` + revalidación presubmit (idéntico a login/registro). Foco al primer campo
  inválido en submit (ESC-UI-02).
- **Flujo submit:** zod OK → construir `CriteriosBusqueda` (oficio+ubicacion+filtros vigentes, `page=1`) →
  `criteriosToQueryString` → `startTransition(() => router.push('/prestadores?' + qs))`. zod falla → bloquea,
  inline error, NINGÚN `router.push` (sin HTTP, ESC-UI-02).
- **Filtros (`filtros-panel.tsx`):** cambiar `orden`/`calificacionMin`/`fecha` → `withFiltroAplicado` (resetea
  `page=1`, REQ-02) → `router.push`. "Limpiar filtros" → `limpiarFiltros`. "Restablecer" → `restablecer`.
  Responsive: sidebar en desktop, sheet/drawer en mobile (REQ-12) — drawer construido sobre primitivas, sin
  lib nueva.

### 5.2 Página de listado (`app/prestadores/page.tsx`, Server Component)

```ts
export default async function PrestadoresPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const criterios = criteriosFromSearchParams(sp);
  // Guard ADR-04-03: sin oficio||ubicacion → estado inicial neutro, NO fetch.
  // Con ambos → const res = await buscarPrestadores(criterios as CriteriosBusqueda)
  //   res.ok && total===0 → <EstadoVacio/>   (ADR-04-04)
  //   res.ok && total>0    → <ResultadosLista/>
  //   !res.ok              → <EstadoError/>   (network|server)
}
```

- `loading.tsx` provee el skeleton durante el re-render (REQ-05 cargando, `aria-busy`).
- La barra y los filtros reciben los criterios actuales como props (hidratan desde la URL).

### 5.3 Página de perfil (`app/prestadores/[id]/page.tsx`, Server Component)

```ts
export default async function PerfilPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // const res = await obtenerPerfil(id)
  //   res.ok                      → <PerfilPrestador data={res.data}/>   (REQ-07)
  //   kind==='not_found'          → notFound()  ó  render <PerfilNoEncontrado/>  (REQ-09/ESC-UI-06)
  //   kind==='network'|'server'   → <EstadoError/>  (ESC-UI-07)
}
```

- 404 y 400(uuid) ya colapsaron a `not_found` en la capa de datos (ADR-04-02). Se usa `<PerfilNoEncontrado/>`
  (CTA "Volver a la búsqueda" → `/prestadores`) en vez de `notFound()` para controlar el copy es-AR exacto.

---

## 6. Accesibilidad checklist (mapeado a componentes)

| Requisito (spec REQ-11 / §8) | Dónde se realiza |
|---|---|
| `<label>` visible + `aria-required` en oficio/ubicación | `components/ui/field.tsx` + `select.tsx` (reusados) en `barra-busqueda` |
| `aria-invalid` + `aria-describedby` → id del error | `field.tsx`: oficio/ubicación faltantes (ESC-UI-02) |
| Contenedor en carga `aria-busy="true"` | `resultados-skeleton.tsx` + `loading.tsx` (REQ-05) |
| Estado de error `role="alert"` | `estado-error.tsx` (REQ-05/ESC-UI-07) |
| Estado vacío `role="status"` (polite, no alert) | `estado-vacio.tsx` — es informativo, NO error (ESC-UI-03) |
| Calificación accesible por texto (no solo estrellas) | `rating-display.tsx`: estrellas `aria-hidden`, texto "4,5 de 5, N reseñas" (ADR-04-05) |
| Badges con texto + ícono/punto (no solo color, 1.4.1) | `disponibilidad-badge.tsx` (ADR-04-05) |
| Cards navegables por teclado | `prestador-card.tsx` es un `<Link>` (foco nativo, Enter) |
| Paginación navegable por teclado + `aria-current="page"` | `paginacion.tsx` (REQ-06) |
| `focus-visible` ring 2px + offset 2px | global `globals.css` (base) + primitivas shadcn |
| Targets táctiles ≥44px | `ui/button.tsx` sizes + áreas de card/paginación ≥44px |
| Inputs `font-size ≥16px` | base layer `globals.css` + `ui/input.tsx` |
| Decimales con coma es-AR | `lib/catalogo/rating.ts` `formatRating` |
| `lang="es-AR"` | `<html>` en `layout.tsx` (base) |
| Contraste AA claro/oscuro | tokens §2.5 (no introducir colores fuera de `@theme`) |
| Filtros mobile en drawer operable por teclado | `filtros-panel.tsx` (focus-trap, Esc cierra) |

---

## 7. Mapeo Escenario → implementación

| Escenario (spec) | Componente / función | Cómo se testea (insumo Verificador) |
|---|---|---|
| **ESC-UI-01** búsqueda 200 → cards + paginación | `page.tsx` await searchParams → `buscarPrestadores` `{ok:true,total>0}` → `<ResultadosLista/>` (`<PrestadorCard/>`+`<Paginacion/>`) | **Unit:** `buscarPrestadores` mapea 200→`{ok:true,data}`; `criteriosToQueryString` whitelist; `formatRating`/`ratingAccesible`. **E2E:** navegar a `/prestadores?oficio=…&ubicacion=…`, mock 200, assert N cards, total, paginación con `aria-current`, orden default=calificación |
| **ESC-UI-02** validación cliente bloquea submit | `busqueda.ts` (zod onBlur) + `barra-busqueda` (no `router.push` si inválido) | **Unit zod:** oficio vacío / ubicación vacía → issues; ambos presentes → ok. **E2E:** dejar oficio/ubicación vacío + "Buscar" → sin navegación/HTTP, ErrorText + `aria-invalid`, foco al primer faltante |
| **ESC-UI-03** sin resultados vs ubicación no resuelta | `buscarPrestadores` `{ok:true,total:0}` → `<EstadoVacio/>` (neutro `role=status`) + sugerencias incl. guía de ubicación | **Unit:** 200 `data:[]` → `{ok:true,total:0}` (NO error). **E2E:** mock 200 vacío → estado neutro, mensaje con {oficio}/{ubicacion}, sugerencias visibles, form editable, NO `role=alert` |
| **ESC-UI-04** cambio orden/filtro re-ejecuta sin recarga | `filtros-panel` → `withFiltroAplicado`(page=1) → `router.push`; "Restablecer" → `restablecer` | **Unit:** `withFiltroAplicado` resetea page=1; `restablecer` → orden=calificacion,page=1,pageSize=20,sin filtros; `criteriosToQueryString` NUNCA emite clave desconocida. **E2E:** cambiar orden→URL cambia, page vuelve a 1, sin full reload (skeletons via loading.tsx) |
| **ESC-UI-05** perfil completo | `[id]/page.tsx` → `obtenerPerfil` `{ok:true}` → `<PerfilPrestador/>` (servicios, reseñas, zona, rating) + `<SolicitarCta/>` | **Unit:** `obtenerPerfil` mapea 200→`{ok:true,data}`; tipo NO declara contacto (RN-CAT-05). **E2E:** mock 200, assert nombre/oficios/rating/zona/servicios(min–max)/reseñas; assert NO hay teléfono/email; CTA "Solicitar" presente |
| **ESC-UI-06** perfil inexistente / id inválido | `obtenerPerfil` 404∨400→`not_found` → `<PerfilNoEncontrado/>` + CTA "Volver a la búsqueda" | **Unit:** `obtenerPerfil` mapea 404→`not_found` y 400→`not_found` (colapso). **E2E:** mock 404 (y 400) → pantalla "No encontramos este prestador", CTA a `/prestadores`, sin detalle técnico |
| **ESC-UI-07** error de red / 5xx | `buscarPrestadores`/`obtenerPerfil` `network`∨`server` → `<EstadoError/>` (`role=alert` + "Reintentar"→router.refresh) | **Unit:** `kind:'network'`/`'server'` por status. **E2E:** abortar request / mock 500 → `role=alert`, botón "Reintentar", distinto de vacío, sin trazas |

---

## 8. Pre/postcondiciones OCL-style (→ aserciones de test)

### `buscarPrestadores(criterios): Promise<BuscarResult>`

```
context buscarPrestadores(criterios)
  pre  P1: criterios.oficio is non-empty string
  pre  P2: criterios.ubicacion is non-empty string
  post Q1: HTTP 200 ⇒ result = {ok:true, data:{data,total,page,pageSize}}  (total puede ser 0)
  post Q2: HTTP 200 con data:[] (sin resultados O geocoding-fail) ⇒ result.ok=true (NUNCA error)
  post Q3: HTTP 400 ⇒ result.kind='bad_request'  (no debería ocurrir; guard ADR-04-03)
  post Q4: HTTP 5xx o body sin {data,total,page,pageSize} ⇒ result.kind='server'
  post Q5: fallo de transporte ⇒ result.kind='network'
  post Q6: la función NUNCA lanza por 4xx
```

### `obtenerPerfil(id): Promise<PerfilResult>`

```
context obtenerPerfil(id)
  pre  P1: id is non-empty string
  post Q1: HTTP 200 ⇒ result={ok:true,data} y data NO contiene teléfono/email (RN-CAT-05)
  post Q2: HTTP 404 ⇒ result.kind='not_found'
  post Q3: HTTP 400 (id no UUID) ⇒ result.kind='not_found'  (colapso deliberado, REQ-09)
  post Q4: HTTP 5xx ⇒ result.kind='server'; transporte ⇒ 'network'
  post Q5: la función NUNCA lanza por 4xx
```

### `criteriosToQueryString(c): string`  /  `criteriosFromSearchParams(sp)`

```
context criteriosToQueryString(c)
  post Q1: la querystring SOLO contiene claves ∈ whitelist (jamás un param desconocido — REQ-02)
  post Q2: una clave con valor undefined NO aparece en la querystring
  post Q3: round-trip: criteriosFromSearchParams(parse(criteriosToQueryString(c))) ≡ c (claves válidas)

context criteriosFromSearchParams(sp)
  post Q4: claves desconocidas en sp se descartan (no aparecen en el resultado)
  post Q5: orden ∉ {'calificacion','distancia','disponibilidad'} ⇒ se ignora (no se propaga)
  post Q6: calificacionMin fuera de 1..5 ó page<1 ⇒ se ignora
```

### `mapDisponibilidad(v)`  /  `formatRating(n)`  /  `ratingAccesible(n,N)`

```
context mapDisponibilidad(v)
  post Q1: v='disponible_esta_semana' ⇒ {token:'accent-subtle', label,icono}
  post Q2: v='proxima_disponible'     ⇒ {token:'warning-subtle', ...}
  post Q3: v='sin_disponibilidad'     ⇒ {token:'surface-sunken', ...}
  post Q4: v=null ⇒ null (el badge NO se renderiza)

context formatRating(n)
  post Q5: usa coma decimal es-AR  (formatRating(4.5)='4,5')
context ratingAccesible(n,N)
  post Q6: devuelve "{formatRating(n)} de 5, {N} reseñas"  (texto SIEMPRE presente, ADR-04-05)
```

---

## 9. Plan de testing (alineado con UC01/UC02)

**Unit (vitest, `test:unit`)** — funciones puras nuevas, sin DOM:
- `lib/api/catalogo.ts`: `buscarPrestadores`/`obtenerPerfil` — mockear `fetch`, assert `kind` por status
  (OCL §8). Verificar Q2 (200 vacío ≠ error) y Q2/Q3 de perfil (404 y 400 → `not_found`).
- `lib/catalogo/query-params.ts`: whitelist en ambas direcciones, round-trip, descarte de claves/valores
  inválidos, `withFiltroAplicado`/`limpiarFiltros`/`restablecer` (reglas REQ-02).
- `lib/catalogo/disponibilidad.ts`: `mapDisponibilidad` (4 ramas, incl. `null` → no badge).
- `lib/catalogo/rating.ts`: `formatRating` (coma es-AR, redondeo), `ratingAccesible` (texto completo).
- `lib/validation/busqueda.ts`: oficio vacío bloquea, ubicación vacía bloquea, ambos presentes pasan.

**E2E (Playwright, `test:e2e`)** — uno por escenario ESC-UI-01..07 (ver §7), interceptando el GET al backend
(`page.route('**/catalogo/prestadores**', …)`) para forzar cada status (200 con/ sin data, 400, 404, 500,
abort). Assertions clave: cards + paginación + `aria-current`; estado vacío neutro vs `role=alert`; perfil
sin datos de contacto; CTA presente; URL refleja filtros y `page=1` al cambiar filtro; "Reintentar" en error.

El Verificador escribe los tests; este diseño le entrega firmas, OCL y mapeo escenario→aserción como contrato.

---

## 10. Supuestos (para el HITL gate)

| ID | Supuesto | Riesgo si falla | Default tomado |
|---|---|---|---|
| **S1** | El fetch server-side usa `BACKEND_URL` (server-only env, mismo que el rewrite); en Server Component NO se puede usar la ruta relativa `/api/...`. | Si el RSC usara `/api/...`, el fetch fallaría (sin origen). | fetch absoluto a `BACKEND_URL ?? http://localhost:3000` + `cache:'no-store'`. **Confirmar la env en el deploy.** |
| **S2** | Las 7 categorías de oficio (RF-2.1, Anexo A) se modelan como lista estática en `lib/catalogo/oficios.ts` (no hay endpoint de catálogo en alcance). Coherente con `lib/trades.ts` de UC01. | Lista desincronizada con seeds → un oficio válido en BD no aparece en el combo (o viceversa → 400). | Lista estática espejando los seeds. **Confirmar contra seeds reales / reusar `lib/trades.ts` si aplica.** |
| **S3** | Ruta `/prestadores` (listado) + `/prestadores/:id` (perfil), públicas (REQ-10), ya en el allowlist del `middleware.ts` de UC02. | Si el matcher las protegiera, redirigiría a /login (rompe REQ-10). | Confirmado por UC02 Supuesto S3 (búsqueda pública). **Verificar el matcher real al implementar.** |
| **S4** | El backend NO distingue "sin resultados" de "geocoding falló" (ambos 200 `data:[]`); la UI no puede inferirlo y ofrece la guía de ubicación como sugerencia del estado vacío. | Si hubiese un flag, se podría dar un mensaje más preciso. | Estado vacío único con guía de ubicación incluida (ADR-04-04). **Confirmar que el contrato no expone un flag.** |
| **S5** | El CTA "Solicitar" redirige a `/login?next=/prestadores/{id}` (placeholder UC07/08); el destino real lo define UC07/08. | Redirect a flujo inexistente | CTA encamina a login/aviso "Próximamente"; no crea contratación (REQ-08). **Confirmar comportamiento exacto en HITL.** |
| **S6** | `pageSize` por defecto = 20 (RN/DESIGN-SYSTEM §5.10); el selector de pageSize no es requisito (se fija 20 salvo override por URL). | UX de paginación distinta a la esperada | pageSize=20 default, page por URL. |

---

*Fin del diseño UC04-UI-Búsqueda+Perfil. Próxima fase: `sdd-tasks` (descomposición en pasos de
implementación), una vez aprobado este diseño en el HITL gate. La decisión central (SSR + estado de búsqueda
en la URL via searchParams, sin libs de data-fetching) sienta el precedente de toda pantalla de listado/
filtro de la app.*
