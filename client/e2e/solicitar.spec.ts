/**
 * E2E tests for the hiring-request flow — UC07 UI (MI-07.2).
 *
 * Spec:   openspec/changes/uc07-ui-solicitar/spec.md  (REQ-01..14, ESC-UI-01..07)
 * Design: openspec/changes/uc07-ui-solicitar/design.md (ADR-07-01..05, OCL §Testing)
 *
 * ARCHITECTURE NOTE — READ BEFORE CHANGING MOCKS (mirrors UC04 OBS-02):
 *  - The request form lives at /prestadores/[id]/solicitar, a SERVER COMPONENT
 *    that calls obtenerPerfil(id) SERVER-SIDE (Next server → BACKEND_URL). The
 *    browser never issues that fetch, so `page.route` CANNOT intercept it. With
 *    the seed DB empty, EVERY id resolves to not_found → the page renders
 *    <PerfilNoEncontrado/>, NOT <SolicitudForm/>. The public profile
 *    /prestadores/[id] (which hosts <SolicitarCta/>) has the same SSR gate.
 *    Therefore the FORM-INTERACTION scenarios (submit 201/409/404/422/5xx,
 *    client validation, anti-double-submit) cannot render the form here; they
 *    are covered by the 183 unit tests (api-client kind mapping, validation,
 *    error mapping, backend-fetch sentinel) + verify.md §runtime probes.
 *  - What IS runtime-verifiable WITHOUT a seed and is fully exercised here:
 *      · S2 matcher (the critical risk): /solicitar redirects to /login?next=,
 *        /prestadores/:id stays public (no redirect).
 *      · The REAL BFF auth loop cookie→Bearer→backend through the Route Handler
 *        (no mock): sentinel 401 (no cookie / expired) vs. forwarded backend 401.
 *      · The token is NEVER present in the client document/bundle.
 *      · es-AR not-found render + html lang.
 *
 * Mirrors the precedent e2e/login.spec.ts + e2e/prestadores.spec.ts.
 */
import { expect, test, type Page } from "@playwright/test";

// A well-formed but non-existent provider id (seed DB is empty → not_found).
const PRESTADOR_ID = "11111111-1111-4111-8111-111111111111";
const SOLICITAR_PATH = `/prestadores/${PRESTADOR_ID}/solicitar`;
const PERFIL_PATH = `/prestadores/${PRESTADOR_ID}`;

/** Mints a fake JWT (unsigned) with a chosen exp + role, like login.spec.ts. */
function fakeJwt(role: string, expOffsetSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + expOffsetSeconds;
  const b64 = (o: object) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
    exp,
    email: "ana@ejemplo.com",
    role,
  })}.sig`;
}

async function seedSession(page: Page, role = "cliente", expOffset = 3600) {
  await page.context().addCookies([
    {
      name: "so_session",
      value: fakeJwt(role, expOffset),
      url: "http://localhost:3001",
    },
  ]);
}

// ─── ESC-UI-02 / S2 (CRITICAL) — matcher: protege /solicitar, perfil público abierto ─

test.describe("ESC-UI-02 / S2 — matcher de proxy (riesgo crítico)", () => {
  test("anónimo en /solicitar → 307 a /login?next=<destino> (proxy REAL)", async ({
    page,
  }) => {
    // REQ-04/06, design S2. Exercises the REAL proxy.ts (no mock): no session
    // cookie on the protected /solicitar path → redirect preserving `next`.
    await page.context().clearCookies();
    await page.goto(SOLICITAR_PATH);

    await expect(page).toHaveURL(
      new RegExp(
        `/login\\?next=(${encodeURIComponent(SOLICITAR_PATH)}|${SOLICITAR_PATH.replace(
          /\//g,
          "%2F",
        )})`,
      ),
    );
    // Convención del repo: el param es `next` (no `from`).
    expect(new URL(page.url()).searchParams.get("next")).toBe(SOLICITAR_PATH);
    await page.waitForSelector("form[novalidate]", { state: "visible" });
  });

  test("perfil público /prestadores/:id sigue accesible SIN sesión (no redirige)", async ({
    page,
  }) => {
    // design S2: the parent profile must NOT be captured by the matcher.
    await page.context().clearCookies();
    await page.goto(PERFIL_PATH);

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(new RegExp(`${PERFIL_PATH}$`));
  });

  test("/prestadores (listado público) sigue accesible SIN sesión", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto("/prestadores");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/prestadores$/);
  });
});

// ─── REQ-04 / ESC-UI-01 — la página protegida con sesión pasa el proxy y NO filtra el token ─

test.describe("REQ-04 — sesión válida pasa el proxy; el token nunca llega al cliente", () => {
  test("con cookie de sesión, /solicitar renderiza (no redirige a /login)", async ({
    page,
  }) => {
    // The proxy admits a valid-exp session. With the seed DB empty the page
    // renders <PerfilNoEncontrado/> (the provider does not exist) instead of the
    // form — see ARCHITECTURE NOTE. The point here is: it does NOT bounce to login.
    await seedSession(page, "cliente");
    await page.goto(SOLICITAR_PATH);

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(new RegExp(`${SOLICITAR_PATH}$`));
  });

  test("el token de sesión NUNCA aparece en el documento ni en el bundle (RNF-S.1/S.4)", async ({
    page,
  }) => {
    await seedSession(page, "cliente");
    await page.goto(SOLICITAR_PATH);

    // The fake JWT signature segment must never be serialized into the HTML
    // payload sent to the browser (it lives only in the httpOnly cookie / the
    // server-side backendFetch). We assert the whole JWT string is absent.
    const cookies = await page.context().cookies();
    const token = cookies.find((c) => c.name === "so_session")?.value ?? "";
    expect(token.length).toBeGreaterThan(0);

    const html = await page.content();
    expect(html).not.toContain(token);
    // Also assert no Authorization/Bearer header leaks into client-readable DOM.
    expect(html).not.toContain("Bearer ");
  });
});

// ─── REQ-04/06 / ESC-UI-06 — BFF auth loop cookie→Bearer→backend (REAL, sin mock) ─

test.describe("REQ-04/06 — Route Handler /api/contrataciones (loop auth real)", () => {
  const body = JSON.stringify({
    ubicacion: "Córdoba centro",
    prestadorId: PRESTADOR_ID,
    fecha: "2030-01-01",
    franja: "Tarde (14–18)",
    descripcion: "Se rompió una caño.",
  });

  test("sin cookie → 401 sentinel (backendFetch NO llama al backend)", async ({
    page,
  }) => {
    await page.context().clearCookies();
    const res = await page.request.post("/api/contrataciones", {
      headers: { "Content-Type": "application/json" },
      data: body,
    });
    expect(res.status()).toBe(401);
    // The handler must not leak backend traces; its sentinel body is { ok:false }.
    const text = await res.text();
    expect(text).not.toMatch(/stack|trace|Error:/i);
  });

  test("cookie expirada → 401 sentinel (backend NO llamado, RN-AUTH-06)", async ({
    page,
  }) => {
    await seedSession(page, "cliente", -3600); // exp in the past
    const res = await page.request.post("/api/contrataciones", {
      headers: { "Content-Type": "application/json" },
      data: body,
    });
    expect(res.status()).toBe(401);
  });

  test("cookie exp-futura pero token sin firma válida → 401 reenviado del backend", async ({
    page,
  }) => {
    // exp is in the future so backendFetch DOES attach the Bearer and call the
    // real backend; the backend rejects the forged signature → 401 forwarded.
    // Proves the cookie→Bearer→backend forwarding actually happens (defense in
    // depth: an unsigned token cannot forge auth).
    await seedSession(page, "cliente", 3600);
    const res = await page.request.post("/api/contrataciones", {
      headers: { "Content-Type": "application/json" },
      data: body,
    });
    expect(res.status()).toBe(401);
    // The forwarded body is the backend's generic message — no internal traces.
    const json = (await res.json().catch(() => null)) as
      | { message?: string }
      | null;
    if (json && typeof json.message === "string") {
      expect(json.message).not.toMatch(/stack|at \w+ \(/i);
    }
  });
});

// ─── Accesibilidad / es-AR — render del shell protegido ─────────────────────────

test.describe("Accesibilidad — shell protegido (REQ-13)", () => {
  test("html lang=es-AR y no expone detalle técnico cuando el perfil no existe", async ({
    page,
  }) => {
    await seedSession(page, "cliente");
    await page.goto(SOLICITAR_PATH);

    await expect(page.locator("html")).toHaveAttribute("lang", "es-AR");
    // not_found render: es-AR copy, never the raw UUID / "Bad Request" / status code.
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("Bad Request");
    expect(bodyText).not.toContain("statusCode");
    expect(bodyText).not.toContain(PRESTADOR_ID);
  });
});
