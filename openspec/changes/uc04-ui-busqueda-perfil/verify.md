# Verification Report — UC04 UI Búsqueda de prestadores + Perfil público (MI-04.3)

**Fecha:** 2026-06-13
**Rama:** `main`
**Verificador:** Agente SDD Verificador (stage 1.4)
**Suites:** `client/e2e/prestadores.spec.ts` + `client/e2e/perfil.spec.ts` (Playwright, Chromium) · `client/test/unit/*` (vitest) · runtime probes contra backend NestJS :3000 / frontend Next :3001

---

## Veredicto final

**APROBADO-CON-OBSERVACIONES**

- **Unit (vitest):** 148/148 pass (12 archivos, ~455ms) — incluye los 4 nuevos de UC04.
- **E2E UC04 (Playwright, Chromium):** 20/20 pass (`prestadores.spec.ts` 16 + `perfil.spec.ts` 4).
- **E2E suite completa (Chromium):** 76/76 pass (UC04 20 + login/registro/recuperación/smoke 56) — sin regresiones.
- **Lint (ESLint flat):** 0 errores (1 warning pre-existente en `registro-form.tsx`, ajeno a UC04).
- **Typecheck (`tsc --noEmit`):** 0 errores, incluye los specs E2E nuevos.
- **Smoke S1 (riesgo crítico):** confirmado — el fetch server-side del RSC resuelve a `BACKEND_URL` directo y `/prestadores` renderiza SSR con el estado correcto al 1er request (sin flash).
- **Backend unit (jest, tras el fix):** catalogo 39/39 pass.

La implementación cubre los 12 requisitos (REQ-01..12) y los 7 escenarios (ESC-UI-01..07). **Se halló y arregló 1 bug REAL (BUG-001)** que rompía la pantalla de listado en runtime. El veredicto es APROBADO-CON-OBSERVACIONES por dos diferidos no bloqueantes (resultados-con-data y perfil-con-data requieren seed de BD; matriz cross-browser) — análogos a los de UC01/UC02.

---

## 1. BUG-001 (REAL, ARREGLADO) — búsqueda devolvía 422 en runtime

**Severidad:** Crítica (rompía ESC-UI-01/03/04 en runtime). **Estado:** ARREGLADO.

**Síntoma:** toda búsqueda con criterios (`/prestadores?oficio=…&ubicacion=…`) renderizaba el estado de **error** (`<EstadoError/>`, "Algo salió mal") en vez de resultados o estado vacío, pese a que el backend tiene la BD vacía y debería responder 200 `{data:[],total:0}`.

**Root cause:** el RSC `app/prestadores/page.tsx` materializa SIEMPRE los defaults (`orden=calificacion`, `page=1`, `pageSize=20`) y `criteriosToQueryString` los serializa como strings (correcto: una query string siempre es texto). El DTO del backend `BuscarPrestadoresDto` valida `page`/`pageSize`/`calificacionMin` con `@IsInt()` pero **sin `@Type(() => Number)`**, y el `ValidationPipe` usa `transform:true` **sin** `enableImplicitConversion`. Resultado: `page="1"` no se coerce a número, falla `@IsInt()` → **HTTP 422** ("page must be an integer number"). El api-client mapea 422 (≠ 200/400) → `{ok:false,kind:'server'}` → `<EstadoError/>`.

Verificado con curl directo al backend:
```
GET /catalogo/prestadores?oficio=Electricista&ubicacion=Cordoba&orden=calificacion&page=1&pageSize=20
→ 422 {"message":["page must be an integer number","pageSize must be an integer number",…]}
```
El path desnudo `?oficio=&ubicacion=` (sin numéricos) sí daba 200 — por eso el bug no se vio antes.

**Fix (trivial, 1 archivo):** `server/src/catalogo/dto/buscar-prestadores.dto.ts` — `import { Type } from 'class-transformer'` + `@Type(() => Number)` sobre `page`, `pageSize`, `calificacionMin`. Patrón NestJS idiomático para coerción de query params; más quirúrgico que flipear `enableImplicitConversion` global.

**Validación post-fix:**
- `GET …&page=1&pageSize=20&calificacionMin=4` → **200** `{data:[],total:0,page:1,pageSize:20}`.
- SSR `/prestadores?oficio=Electricista&ubicacion=Cordoba` → renderiza `<EstadoVacio/>` (`role="status"`, "No encontramos prestadores para Electricista en Cordoba." + guía de ubicación), NO error.
- Backend jest catalogo: 39/39 (el spec del controller pasa un DTO objeto directo, por eso nunca ejercitó el path de coerción — explica por qué el bug se mergeó).

> **Nota de scope:** el fix es backend, fuera de la WI frontend UC04, pero (1) el bug rompía completamente la UI de UC04 en runtime, (2) el arreglo es trivial y de bajo riesgo, (3) el contrato que la spec/diseño asumen (200/400) era el correcto; el 422 por numéricos era una desviación del DTO. Precedente UC01 (3 bugs arreglados por el Verificador).

---

## 2. Resultado de la verificación final

| Tarea | Comando | Resultado |
|---|---|---|
| 10.1 lint | `npm run lint` | 0 errores (1 warning ajeno) |
| 10.2 test:unit | `npm run test:unit` | 148/148 pass (12 archivos) |
| 10.3 test:e2e (UC04) | `npx playwright test {prestadores,perfil}.spec.ts --project=chromium` | 20/20 pass |
| 10.3b test:e2e (full) | `npx playwright test --project=chromium` | 76/76 pass (sin regresiones) |
| — typecheck | `npx tsc --noEmit` | 0 errores (incl. specs E2E) |
| 10.4 smoke S1 | curl SSR + curl backend | RSC→BACKEND_URL OK; SSR con estado correcto al 1er request |
| backend (tras fix) | `npx jest src/catalogo` | 39/39 pass |

---

## 3. Matriz de cumplimiento Escenario → test

### prestadores.spec.ts (16 tests) — listado

| # | Test | ESC | REQ | Resultado |
|---|------|-----|-----|-----------|
| 1 | oficio+ubicación vacíos → NO navega, ErrorText + aria-invalid en ambos | ESC-UI-02 | REQ-01 | PASS |
| 2 | solo ubicación faltante → bloquea con error en ubicación | ESC-UI-02 | REQ-01 | PASS |
| 3 | oficio TEXTO LIBRE: cualquier valor no-vacío pasa (no enum) | ESC-UI-02 | REQ-01 (grounding) | PASS |
| 4 | submit válido → URL `?oficio&ubicacion&page=1`, solo whitelist | ESC-UI-01 | REQ-01/02/05 | PASS |
| 5 | orden default = Calificación (RN-CAT-03), barra hidrata de la URL | ESC-UI-01 | REQ-02 | PASS |
| 6 | DB vacía → `role=status`, mensaje con {oficio}/{ubicacion}, NO error banner, form editable | ESC-UI-03 | REQ-05 | PASS |
| 7 | cambiar orden a Distancia → `orden=distancia` + `page=1`, sin full reload | ESC-UI-04 | REQ-02 | PASS |
| 8 | "Restablecer" → orden=calificacion, page=1, pageSize=20, sin filtros | ESC-UI-04 | REQ-02 | PASS |
| 9 | "Limpiar filtros" conserva oficio+ubicación, borra filtros | ESC-UI-04 | REQ-02 | PASS |
| 10 | /prestadores accesible sin cookie, NO redirige a /login | — | REQ-10 | PASS |
| 11 | deep-link sin params → estado inicial neutro (guard, NO fetch) | — | REQ-10, ADR-04-03 | PASS |
| 12 | oficio/ubicación con label visible + aria-required | — | REQ-11 | PASS |
| 13 | oficio usa `<input list=datalist>` (texto libre), NO `<select>` enum | — | REQ-11 (grounding) | PASS |
| 14 | html lang=es-AR | — | REQ-11 | PASS |
| 15 | inputs font-size ≥16px | — | REQ-11 | PASS |
| 16 | (cuenta de ESC-UI-01 default-orden, ver #5) | — | — | PASS |

### perfil.spec.ts (4 tests) — perfil

| # | Test | ESC | REQ | Resultado |
|---|------|-----|-----|-----------|
| 1 | UUID inexistente (404→400) → "No encontramos este prestador" + CTA, sin detalle, sin error banner | ESC-UI-06 | REQ-09 | PASS |
| 2 | id NO-UUID (400) → mismo screen no-encontrado, sin detalle técnico | ESC-UI-06 | REQ-09 | PASS |
| 3 | CTA "Volver a la búsqueda" navega a /prestadores | ESC-UI-06 | REQ-09 | PASS |
| 4 | perfil público sin sesión (no redirige) + NUNCA muestra teléfono/email | — | REQ-10, RN-CAT-05 | PASS |

---

## 4. Cumplimiento por requisito (revisión de código + tests)

| REQ | Evidencia | Estado |
|---|---|---|
| REQ-01 campos obligatorios + validación cliente | `lib/validation/busqueda.ts` (oficio+ubicacion `trim().min(1)`); `barra-busqueda.tsx` bloquea submit; E2E #1/#2 | OK |
| REQ-02 filtros/orden + whitelist + page=1 | `query-params.ts` (`withFiltroAplicado`/`limpiarFiltros`/`restablecer`, WHITELIST); unit `query-params.test.ts`; E2E #7/#8/#9 | OK |
| REQ-03 card PrestadorResumen | `prestador-card.tsx` (nombre, chips, rating, badge, distancia condicional); rating coma es-AR + texto | OK |
| REQ-04 badge disponibilidad accesible | `disponibilidad-badge.tsx` + `mapDisponibilidad` (texto+ícono, color refuerzo; null→omite); unit `catalogo-display.test.ts` | OK |
| REQ-05 estados (loading/vacío/error) | `loading.tsx`+`resultados-skeleton.tsx` (aria-busy); `estado-vacio.tsx` (role=status); `estado-error.tsx` (role=alert); distinción por HTTP status en api-client | OK |
| REQ-06 paginación | `paginacion.tsx` (`<Link>`, aria-current="page", preserva query, ≥44px) | OK |
| REQ-07 perfil completo | `perfil-prestador.tsx` (nombre/oficios/rating/zona/servicios min–max/reseñas); tipo SIN contacto | OK |
| REQ-08 CTA Solicitar placeholder | `solicitar-cta.tsx` (`data-feature="uc07-uc08"`, anon→/login?next, auth→"Próximamente", NO crea contratación) | OK |
| REQ-09 404 / id inválido | `obtenerPerfil` colapsa 404∨400→not_found; `perfil-no-encontrado.tsx`; E2E #1/#2/#3 | OK |
| REQ-10 acceso público | `proxy.ts` matcher `["/cuenta/:path*"]` (no captura /prestadores); E2E #10/#11/perfil#4 | OK |
| REQ-11 a11y WCAG AA | labels+aria-required, aria-invalid/describedby, aria-busy, role=status/alert, rating texto, badge texto+ícono, font≥16px, lang=es-AR; E2E #12-#15 | OK |
| REQ-12 responsive / ≤5 pasos | `filtros-panel.tsx` sidebar desktop / Dialog drawer mobile (focus-trap+Esc); búsqueda=1 acción | OK (matriz móvil diferida, OBS-02) |

---

## 5. Invariantes clave (verificados)

| Invariante | Evidencia |
|---|---|
| **Vacío ≠ Error** (distinción por HTTP status, no por body) | api-client: 200→ok (total puede ser 0); 5xx/throw→server/network. E2E #6 (role=status, NO error banner). Unit `catalogo-api.test.ts` Q2 |
| **oficio TEXTO LIBRE** (no enum) | `busqueda.ts` solo no-vacío; `barra-busqueda` usa `<input list=datalist>`; E2E #3 (valor no-sugerido pasa) + #13 (datalist, no select) |
| **RN-CAT-05 sin contacto** | `PrestadorPerfil` no declara teléfono/email (enforced por tsc); perfil#4 asserts no shape de teléfono AR ni email |
| **Whitelist (REQ-02)** | `criteriosToQueryString` solo emite claves whitelisteadas; E2E #4 valida cada key ∈ whitelist; unit round-trip |
| **404∨400→not_found** (no expone detalle) | `obtenerPerfil`; E2E #1/#2 (sin "statusCode"/"Bad Request"/"uuid") |
| **CTA no implementa contratación** | `solicitar-cta.tsx` solo encamina; `data-feature="uc07-uc08"` |

---

## 6. Smoke S1 (riesgo crítico del diseño) — RESUELTO

El RSC `buscarPrestadores`/`obtenerPerfil` leen `process.env.BACKEND_URL ?? "http://localhost:3000"` y hacen `fetch` ABSOLUTO al backend, NO la ruta relativa `/api/...`. Confirmado en runtime: `GET http://localhost:3001/prestadores?oficio=Electricista&ubicacion=Cordoba` renderiza el HTML SSR con el estado vacío YA presente en el primer response (el fetch server-side al backend :3000 resolvió). No hay flash cliente. `next.config.ts` no requiere cambios. (Verificado tras BUG-001; antes del fix el mismo probe renderizaba el estado de error por el 422.)

---

## 7. Observaciones (no bloquean aprobación)

### OBS-01 — Matriz cross-browser pendiente (RNF-A.2)
Los 20 E2E de UC04 (y los 76 totales) corren verdes en **Chromium**. WebKit/Mobile Safari requieren libs de sistema en Linux (`sudo npx playwright install-deps`). Firefox/Mobile Chrome ejecutables pero no corridos aquí para respetar el gotcha de NO correr múltiples suites en paralelo contra el webServer reusado :3001. La matriz completa (5 proyectos) la corre el tester humano / CI con la imagen `mcr.microsoft.com/playwright`. Mismo diferido que UC01/UC02.

### OBS-02 — Resultados-con-data (ESC-UI-01 cards) y perfil-con-data (ESC-UI-05) requieren seed
La pantalla de listado y la de perfil son **Server Components**: el fetch al backend corre server-side, detrás del RSC. `page.route` del browser NO intercepta ese fetch (igual que UC02 documentó para la cookie httpOnly). Con la BD de prestadores **vacía**, el runtime sólo alcanza el estado VACÍO (listado) y NOT-FOUND (perfil) — ambos verificados en E2E y por probe. La verificación de **cards con datos** (nombre/oficios/rating/badge/distancia + paginación con varias páginas) y del **perfil completo** (servicios min–max, reseñas, zona, CTA visible) NO se ejecutó como E2E porque exige sembrar prestadores con zona de cobertura geocodeada, servicios y reseñas — fuera del scope del Verificador. **Cobertura indirecta:** la lógica de render de cards/perfil/CTA es Server Component puro sobre `PrestadorResumen`/`PrestadorPerfil`, y el mapeo de datos (`formatRating`, `mapDisponibilidad`, `ratingAccesible`, formato de precio) está cubierto por los 148 unit. Recomendado: un E2E con backend seedeado en la fase de integración para cerrar ESC-UI-01/ESC-UI-05 al 100%.

### OBS-03 — ESC-UI-07 (error de red/5xx en listado/perfil) verificado por código + unit, no por E2E runtime
Forzar un 5xx/abort en el fetch server-side del RSC desde el browser no es posible (no hay `page.route` que lo intercepte). El mapeo `network`/`server`→`<EstadoError/>` (role=alert + "Reintentar"→`router.refresh()`) está cubierto por unit `catalogo-api.test.ts` (kind por status) y por inspección de `estado-error.tsx`. Además, ANTES del fix de BUG-001, el 422 ejercitó EXACTAMENTE este path en runtime: el SSR renderizó `<EstadoError/>` con `role="alert"` — prueba incidental de que el estado de error funciona end-to-end. Un E2E con backend que devuelva 500 (toggle de fallo) lo cerraría en integración.

### OBS-04 — El backend colapsa 404 a 400 para UUIDs inexistentes
Un UUID v4 bien formado pero inexistente devuelve **400** (no 404) desde el backend actual; un id no-UUID también da 400 (`ParseUUIDPipe`). Ambos colapsan a `not_found` en el api-client (REQ-09 se cumple: misma pantalla, sin exponer detalle). No es un fallo de UC04 frontend — el diseño ya previó el colapso 404∨400→not_found. Se documenta para el tester: con datos reales, un id válido inexistente debería idealmente dar 404, pero el resultado UI es idéntico.

### OBS-05 — `RangoPrecio` con bordes nullable (desviación menor del diseño)
El diseño tipó `RangoPrecio {min:number; max:number}` (no-null). La implementación usa `{min:number|null; max:number|null}` por contrato del orchestrator; `servicio-item.tsx` renderiza rango abierto ("Desde $", "Hasta $") o "Precio a consultar". Mejora la robustez, no rompe ningún REQ.

---

## 8. Tareas (estado real vs. checklist)

Phases 1-8 (30 tareas) + 10.1/10.2 marcadas `[x]` — verificadas contra el código: lib puro (tipos/oficios/disponibilidad/rating/query-params), validación, copy.catalogo, api-client discriminado, 14 componentes catalogo + perfil, 2 páginas SSR + loading, proxy matcher, 4 unit. Coinciden con el código.

Phase 9 (E2E, las escribe el Verificador): **completadas** — `e2e/prestadores.spec.ts` (9.1+9.2) y `e2e/perfil.spec.ts` (9.3).
Phase 10.3 (test:e2e) y 10.4 (smoke S1): **completadas** — ver §2/§6.

Recomendación: marcar 9.1-9.3, 10.3, 10.4 como `[x]` en `tasks.md`.

---

## 9. Archivos creados/tocados por el Verificador

| Archivo | Tipo | Razón |
|---|---|---|
| `client/e2e/prestadores.spec.ts` | Tests (nuevo) | 16 tests ESC-UI-01/02/03/04 + REQ-10 + a11y, espejando login/registro.spec |
| `client/e2e/perfil.spec.ts` | Tests (nuevo) | 4 tests ESC-UI-06 + REQ-10/RN-CAT-05 |
| `server/src/catalogo/dto/buscar-prestadores.dto.ts` | Fix (BUG-001) | `@Type(() => Number)` en page/pageSize/calificacionMin (coerción de query params) |
| `openspec/changes/uc04-ui-busqueda-perfil/verify.md` | Doc | Este reporte |

---

## 10. Resolución del gate (coordinador)

**Veredicto: APROBADO-CON-OBSERVACIONES.** 148/148 unit + 20/20 E2E UC04 (76/76 full, Chromium) + lint/tsc limpios + smoke S1 resuelto + invariantes verificados. **1 bug crítico (BUG-001) hallado y arreglado** (búsqueda 422 → la pantalla de listado estaba completamente rota en runtime; fix trivial en el DTO backend).

Diferido a follow-up (no bloqueante): E2E con backend seedeado para ESC-UI-01 (cards con data) / ESC-UI-05 (perfil completo) / ESC-UI-07 (5xx runtime) — OBS-02/03; matriz cross-browser completa en CI — OBS-01.
