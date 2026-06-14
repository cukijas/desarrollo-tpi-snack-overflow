# Tasks: MI-04.3 UI Búsqueda de prestadores + Perfil público (UC04)

> Deriva de `spec.md` (REQ-01..12, ESC-UI-01..07) y `design.md` (ADR-04-01..06, §1 árbol de archivos,
> §3 firmas, §8 OCL, §9 plan de testing). Todas las rutas son relativas a `client/`.
> `[P]` = puede correr en paralelo dentro de la misma fase (sin dependencia de orden entre ellas).
>
> **Stack (verificado vs UC01/UC02):** Next 16.2.9 App Router · React 19.2 · Tailwind v4 · TS strict ·
> RHF 7.79 + zod 4.4 (instalados) · vitest 4.1 · Playwright 1.60. Breaking Next 16: `params`/`searchParams`
> son **Promises** (`await`); Server Components por defecto, `'use client'` solo para estado/handlers.
> El `middleware.ts` clásico está renombrado a **`proxy.ts`** (ya existe, de UC02).
> **Leer `node_modules/next/dist/docs/` antes de codear (AGENTS.md del client).**

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~750-950 (2 páginas SSR + ~14 componentes catalogo + api-client + lib puro + tests) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (lib puro + api-client + copy + validación) → PR 2 (componentes + páginas SSR + proxy verify) → PR 3 (unit + E2E) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Lib puro (tipos, query-params, disponibilidad, rating, oficios) + copy + validación + api-client | PR 1 | Fundación testeable sin DOM. Sienta el patrón URL-state. Base: main |
| 2 | Componentes catalogo + páginas SSR (listado + perfil) + verificación proxy matcher | PR 2 | Depende de Unit 1. Base: main (stacked tras PR 1) |
| 3 | Unit (vitest) + E2E (Playwright) ESC-UI-01..07 + verificación final | PR 3 | Depende de Units 1-2. Los tests los escribe el Verificador. Base: main |

---

## Phase 1: Foundation — lib puro, copy, tipos, validación (sin I/O, sin DOM)

- [x] 1.1 `[P]` Crear `lib/catalogo/tipos.ts`: mirror EXACTO del contrato — `Disponibilidad`, `PrestadorResumen`,
  `RangoPrecio`, `Servicio`, `Resena`, `PrestadorPerfil` (SIN teléfono/email — RN-CAT-05), `PaginatedResult<T>`,
  `Orden`, `CriteriosBusqueda`. (design §3, REQ-03/07, RN-CAT-05)
- [x] 1.2 `[P]` Crear `lib/catalogo/oficios.ts`: catálogo estático de oficios para el combobox de búsqueda (RF-2.1).
  **Decisión S2 (resolver primero):** `lib/trades.ts` de UC01 define **12** oficios, no las "7 categorías" del Anexo A
  citadas en spec/design. Reconciliar contra los seeds reales del backend (`regulated_trades`): reusar/re-exportar
  `TRADES` de `lib/trades.ts` si los `value` coinciden con los seeds de catálogo, o curar la lista exacta. El enum
  de validación (1.5) y el combobox deben usar ESTA fuente única. **No** inventar valores: deben espejar seeds.
  (design Supuesto S2, RF-2.1)
- [x] 1.3 `[P]` Crear `lib/catalogo/disponibilidad.ts`: `mapDisponibilidad(v)` puro → `{label, token, icono}` para las
  3 ramas + `null`→`null` (omitir badge). Tokens: `disponible_esta_semana`→`accent-subtle`,
  `proxima_disponible`→`warning-subtle`, `sin_disponibilidad`→`surface-sunken`. (ADR-04-05, REQ-04, OCL §8 Q1-Q4)
- [x] 1.4 `[P]` Crear `lib/catalogo/rating.ts`: `formatRating(n)` (coma decimal es-AR, `4.5`→`"4,5"`) +
  `ratingAccesible(n, N)` → `"{formatRating(n)} de 5, {N} reseñas"`. Funciones puras. (ADR-04-05, REQ-03/11, OCL §8 Q5-Q6)
- [x] 1.5 `[P]` Crear `lib/validation/busqueda.ts`: schema zod — `oficio` enum (valores de `oficios.ts` 1.2) no-vacío +
  `ubicacion` `trim().min(1)`. Mensajes desde `copy.catalogo.errors`. (ADR-04-03, REQ-01, ESC-UI-02)
  **DESVIACIÓN (grounding orchestrator):** `oficio` NO es enum — es texto libre en el backend. El schema valida solo
  `oficio` no-vacío (trim().min(1)). `oficios.ts` provee sugerencias no-restrictivas (datalist), no un gate.
- [x] 1.6 Extender `lib/copy/es-AR.ts`: agregar sección `copy.catalogo` con textos EXACTOS del catálogo es-AR del spec —
  `errors.oficioRequerido` ("Elegí un oficio."), `errors.ubicacionRequerida` ("Ingresá una ubicación."),
  estados `sinResultados`/`ubicacionNoResuelta`/`errorRed`/`perfilNoEncontrado`, labels de disponibilidad,
  plantilla de calificación accesible, labels de filtros/orden/paginación, CTA "Solicitar"/"Reintentar"/
  "Volver a la búsqueda"/"Limpiar filtros"/"Restablecer". (spec §"Catálogo de mensajes", todos los REQ con copy)
- [x] 1.7 Crear `lib/catalogo/query-params.ts` (depende de 1.1 tipos): funciones puras
  `criteriosFromSearchParams(sp)` (descarta claves desconocidas, `orden` fuera de enum, `calificacionMin` fuera de
  1..5, `page<1`; NUNCA throw) + `criteriosToQueryString(c)` (solo whitelist
  `['oficio','ubicacion','orden','calificacionMin','fecha','page','pageSize']`, omite `undefined`) +
  `withFiltroAplicado(c, patch)` (resetea `page=1`) + `limpiarFiltros(c)` (conserva oficio+ubicacion, `page=1`) +
  `restablecer(c)` (`orden='calificacion'`, `page=1`, `pageSize=20`, sin filtros). (ADR-04-01/03, REQ-02, OCL §8 Q1-Q6)

## Phase 2: api-client — resultados discriminados server-side (espejo del patrón auth)

- [x] 2.1 Crear `lib/api/catalogo.ts` — tipos de resultado: `BuscarResult` (`{ok:true,data}` |
  `bad_request`|`network`|`server`) y `PerfilResult` (`{ok:true,data}` | `not_found`|`network`|`server`).
  Reusar/extraer `safeJson` del patrón de `lib/api/auth.ts`. (ADR-04-02, design §3)
- [x] 2.2 `lib/api/catalogo.ts`: `buscarPrestadores(criterios)` — corre SERVER-SIDE, `fetch(BACKEND_URL +
  "/catalogo/prestadores?" + qs)` con `cache:'no-store'`. **S1 (crítico):** base = `process.env.BACKEND_URL ??
  "http://localhost:3000"` directo al backend, NUNCA la ruta relativa `/api/...` (un RSC no tiene origen). Mapeo:
  200→`{ok:true,data}` validando forma `{data,total,page,pageSize}` (si falta→`server`) · 200 `data:[]`→`{ok:true}`
  (NUNCA error, incluye geocoding-fail) · 400→`bad_request` · 5xx/otro→`server` · throw→`network`. Nunca lanza 4xx.
  (ADR-04-02/04, S1, OCL §8 buscarPrestadores Q1-Q6)
- [x] 2.3 `lib/api/catalogo.ts`: `obtenerPerfil(id)` — `fetch(BACKEND_URL + "/catalogo/prestadores/" + id)`,
  `cache:'no-store'`. Mapeo: 200→`{ok:true,data}` · **404 ∨ 400(uuid inválido)→`not_found`** (colapso deliberado,
  no exponer detalle) · 5xx→`server` · throw→`network`. Nunca lanza 4xx. (ADR-04-02, REQ-09, OCL §8 obtenerPerfil Q1-Q5)

## Phase 3: Componentes presentacionales (Server Components, sin estado) y de datos

- [x] 3.1 `[P]` Crear `components/catalogo/rating-display.tsx` (Server): estrellas `aria-hidden="true"` (decorativas) +
  texto SIEMPRE presente vía `ratingAccesible`. (ADR-04-05, REQ-03/11)
- [x] 3.2 `[P]` Crear `components/catalogo/disponibilidad-badge.tsx` (Server): usa `mapDisponibilidad`; texto + ícono/punto
  (no solo color); `null`→no renderiza. (ADR-04-05, REQ-04, WCAG 1.4.1)
- [x] 3.3 Crear `components/catalogo/prestador-card.tsx` (Server, depende de 3.1/3.2): `<Link>` a `/prestadores/:id`
  (navegable por teclado, foco nativo); nombre, chips de oficios, `<RatingDisplay/>`, `<DisponibilidadBadge/>`,
  `distanciaKm` solo si presente. Target táctil ≥44px. (REQ-03/11, ESC-UI-01)
- [x] 3.4 `[P]` Crear `components/catalogo/resultados-skeleton.tsx` (Server): N cards skeleton, contenedor
  `aria-busy="true"`. (REQ-05 cargando)
- [x] 3.5 `[P]` Crear `components/catalogo/estado-vacio.tsx` (Server): tono NEUTRO, `role="status"` (polite, NO alert);
  mensaje base con `{oficio}`/`{ubicacion}` + sugerencias accionables que SIEMPRE incluyen la guía de ubicación
  (cubre sin-resultados y geocoding-fail sin diagnosticar). Form sigue visible. (ADR-04-04, REQ-05, ESC-UI-03, S4)
- [x] 3.6 `[P]` Crear `components/catalogo/estado-error.tsx` (`'use client'`): `role="alert"` + botón "Reintentar"
  (`router.refresh()`); copy no técnico, sin trazas. (ADR-04-04, REQ-05, ESC-UI-07)

## Phase 4: Componentes interactivos de búsqueda (`'use client'`)

- [x] 4.1 Crear `components/catalogo/barra-busqueda.tsx` (`'use client'`, depende de 1.5/1.7): CORAZÓN del filtro.
  RHF+zod `mode:'onBlur'`, props `{defaults, filtros}` que hidratan desde la URL. Submit: zod OK → construir
  `CriteriosBusqueda` (`page=1`) → `criteriosToQueryString` → `startTransition(() => router.push('/prestadores?'+qs))`.
  zod falla → bloquea (NINGÚN `router.push`, sin HTTP), inline error (`aria-invalid`+`aria-describedby`), foco al
  primer faltante. Reusa `ui/{field,input,label,select,button}`. (ADR-04-01/03, REQ-01, ESC-UI-02)
- [x] 4.2 `[P]` Crear `components/catalogo/filtros-panel.tsx` (`'use client'`, depende de 1.7): controles
  `orden`/`calificacionMin`/`fecha` → `withFiltroAplicado` (reset `page=1`) → `router.push`; "Limpiar filtros"→
  `limpiarFiltros`; "Restablecer"→`restablecer`. Orden default `calificacion` preseleccionado (RN-CAT-03).
  Responsive: sidebar desktop / drawer-sheet mobile (focus-trap, Esc cierra), sobre primitivas sin lib nueva.
  (ADR-04-01, REQ-02/12, ESC-UI-04)
- [x] 4.3 `[P]` Crear `components/catalogo/paginacion.tsx` (`'use client'` o Server con `<Link>`, depende de 1.7):
  controles `page`/`pageSize`, `aria-current="page"` en la actual, preserva query vigente (oficio/ubicacion/
  filtros/orden), reset implícito de page al cambiar. Navegable por teclado. (REQ-06, ESC-UI-04)
- [x] 4.4 Crear `components/catalogo/resultados-lista.tsx` (Server, depende de 3.3/4.3): grid responsive de
  `<PrestadorCard/>` + total ("32 prestadores") + `<Paginacion/>`. Recibe data ya resuelta (sin fetch propio).
  (REQ-05/06, ESC-UI-01)

## Phase 5: Componentes de perfil (`components/catalogo/perfil/`)

- [x] 5.1 `[P]` Crear `components/catalogo/perfil/servicio-item.tsx` (Server): categoría + descripción + rango precio
  `min`–`max`. (REQ-07, ESC-UI-05)
- [x] 5.2 `[P]` Crear `components/catalogo/perfil/resena-item.tsx` (Server): calificación (reusa `<RatingDisplay/>`
  o texto), contenido, fecha, `clienteNombre` si presente. (REQ-07, ESC-UI-05)
- [x] 5.3 `[P]` Crear `components/catalogo/perfil/solicitar-cta.tsx` (`'use client'`): placeholder UC07/08 — sin sesión
  navega a `/login?next=/prestadores/{id}` (reusa patrón `next` de UC02); con sesión muestra aviso "Próximamente".
  Atributo `data-feature="uc07-uc08"`. NO crea contratación. (ADR-04-06, REQ-08, S5)
- [x] 5.4 `[P]` Crear `components/catalogo/perfil/perfil-no-encontrado.tsx` (Server): "No encontramos este prestador" +
  CTA "Volver a la búsqueda" → `/prestadores`. Sin detalle técnico. (REQ-09, ESC-UI-06)
- [x] 5.5 Crear `components/catalogo/perfil/perfil-prestador.tsx` (Server, depende de 3.1/5.1/5.2/5.3): encabezado
  (nombre, chips oficios, `<RatingDisplay/>`), zona de cobertura (`zonaCobertura[]`), lista de `<ServicioItem/>`,
  lista de `<ResenaItem/>`, `<SolicitarCta/>`. **MUST NOT** renderizar teléfono/email. (REQ-07/08, RN-CAT-05, ESC-UI-05)

## Phase 6: Páginas SSR (`app/prestadores/`)

- [x] 6.1 Crear `app/prestadores/page.tsx` (Server Component, depende de Phases 2/3/4): `await searchParams` (Promise) →
  `criteriosFromSearchParams`. **Guard ADR-04-03:** sin `oficio`∨`ubicacion` → render barra vacía + estado inicial
  neutro ("Buscá un oficio en tu zona"), NO fetch. Con ambos → `await buscarPrestadores(criterios)`:
  `ok && total===0`→`<EstadoVacio/>`; `ok && total>0`→`<ResultadosLista/>`; `!ok`→`<EstadoError/>`. La barra y filtros
  reciben criterios actuales como props (hidratan de la URL). Suspense con `<ResultadosSkeleton/>`. (ADR-04-01/03/04,
  REQ-01/02/05/06/10, ESC-UI-01/02/03/04/07, §5.2)
- [x] 6.2 `[P]` Crear `app/prestadores/loading.tsx`: streaming UI de Next — reusa `<ResultadosSkeleton/>` mientras el RSC
  re-fetchea. (REQ-05 cargando, ADR-04-01)
- [x] 6.3 Crear `app/prestadores/[id]/page.tsx` (Server Component, depende de Phase 2/5): `await params.id` →
  `await obtenerPerfil(id)`: `ok`→`<PerfilPrestador/>`; `not_found`→`<PerfilNoEncontrado/>` (copy es-AR exacto, NO
  `notFound()` para controlar el texto); `network`∨`server`→`<EstadoError/>`. (REQ-07/09, ESC-UI-05/06/07, §5.3)

## Phase 7: Proxy matcher — verificación de acceso público (riesgo crítico S3)

- [x] 7.1 Verificar `proxy.ts` (de UC02): confirmar que `config.matcher` NO incluye `/prestadores*` y por ende
  `/prestadores` y `/prestadores/:id` permanecen PÚBLICOS (REQ-10). **Estado verificado en diseño:** el matcher es
  `["/cuenta/:path*"]` → `/prestadores*` ya es público, NO requiere cambio. Esta tarea es de aserción: si un cambio
  futuro amplió el matcher a algo que capture `/prestadores`, AJUSTAR para excluirlo. Documentar el resultado.
  (REQ-10, design Supuesto S3)
  **VERIFICADO:** `proxy.ts` `config.matcher === ["/cuenta/:path*"]`. NO captura `/prestadores` ni `/prestadores/:id`.
  Ambas rutas son PÚBLICAS sin cambio alguno. No se modificó `proxy.ts`.

## Phase 8: Unit tests (vitest — los escribe el Verificador)

- [x] 8.1 `[P]` `lib/api/catalogo.ts`: mockear `fetch`; assert `buscarPrestadores` mapea por status (200/200-vacío/400/
  5xx/throw), verificar Q2 (200 `data:[]` ≠ error) y forma mínima; `obtenerPerfil` Q1-Q5 (incl. 404 y 400→`not_found`).
  Assert NUNCA lanza 4xx. (OCL §8, §9) → `test/unit/catalogo-api.test.ts`
- [x] 8.2 `[P]` `lib/catalogo/query-params.ts`: whitelist en ambas direcciones, round-trip, descarte de claves/valores
  inválidos, `withFiltroAplicado`/`limpiarFiltros`/`restablecer`. (OCL §8 Q1-Q6, REQ-02) → `test/unit/query-params.test.ts`
- [x] 8.3 `[P]` `lib/catalogo/disponibilidad.ts` + `rating.ts`: `mapDisponibilidad` (4 ramas incl. `null`→no badge);
  `formatRating` (coma es-AR, redondeo); `ratingAccesible` (texto completo). (OCL §8) → `test/unit/catalogo-display.test.ts`
- [x] 8.4 `[P]` `lib/validation/busqueda.ts`: oficio vacío bloquea, ubicación vacía bloquea, ambos presentes pasan.
  (ESC-UI-02) → `test/unit/busqueda-schema.test.ts`. NOTA: el sub-caso "oficio fuera del enum" NO aplica — `oficio`
  es texto libre (grounding); en su lugar se testea que CUALQUIER texto libre no-vacío pasa.

## Phase 9: E2E tests (Playwright — los escribe el Verificador)

- [ ] 9.1 Crear `e2e/prestadores.spec.ts` — listado: ESC-UI-01 (mock 200 → N cards + total + paginación `aria-current` +
  orden default calificación); ESC-UI-02 (oficio/ubicación vacío → sin navegación/HTTP + `aria-invalid` + foco al
  faltante); ESC-UI-03 (mock 200 vacío → estado neutro `role=status` con `{oficio}`/`{ubicacion}`, NO `role=alert`,
  form editable). Interceptar `**/catalogo/prestadores**`. (§9, §7)
- [ ] 9.2 `[P]` `e2e/prestadores.spec.ts` — filtros/orden: ESC-UI-04 (cambiar orden→URL cambia, `page` vuelve a 1, sin
  full reload; "Restablecer" → defaults; NUNCA param desconocido). (§9)
- [ ] 9.3 `[P]` Crear `e2e/perfil.spec.ts` — perfil: ESC-UI-05 (mock 200 → nombre/oficios/rating/zona/servicios min–max/
  reseñas; assert NO teléfono/email; CTA "Solicitar" presente); ESC-UI-06 (mock 404 y 400 → "No encontramos este
  prestador" + CTA `/prestadores`, sin detalle); ESC-UI-07 (abort / mock 500 en búsqueda y perfil → `role=alert` +
  "Reintentar", distinto de vacío, sin trazas). (§9, RN-CAT-05)

## Phase 10: Verificación final

- [x] 10.1 Correr `lint` (ESLint flat) — sin errores en archivos nuevos/extendidos. RESULTADO: 0 errores (1 warning
  preexistente en `registro-form.tsx`, ajeno a UC04). Además `tsc --noEmit` limpio (gotcha CI cubierta).
- [x] 10.2 Correr `test:unit` (vitest + coverage-v8) — todos los unit verdes, cubren OCL §8. RESULTADO: 148 tests
  verdes (12 archivos), incl. los 4 nuevos de UC04.
- [ ] 10.3 Correr `test:e2e` (Playwright) — ESC-UI-01..07 verdes en los 3 browsers (Chrome/Firefox/Safari).
- [ ] 10.4 Smoke test de S1: confirmar que el fetch server-side de `buscarPrestadores`/`obtenerPerfil` resuelve a
  `BACKEND_URL` directo (NO `/api/...`) y que `/prestadores` renderiza SSR con datos al 1er request (sin flash).
  (S1 + S3, riesgos críticos)
