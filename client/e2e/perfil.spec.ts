/**
 * E2E tests for the public provider PROFILE screen — UC04 UI.
 *
 * Spec:   openspec/changes/uc04-ui-busqueda-perfil/spec.md  (REQ-07/08/09, ESC-UI-05/06/07)
 * Design: openspec/changes/uc04-ui-busqueda-perfil/design.md (ADR-04-02/06)
 *
 * ARCHITECTURE NOTE:
 *  - /prestadores/[id] is a SERVER COMPONENT: `await params.id` → obtenerPerfil()
 *    runs SERVER-SIDE. As with the listing, `page.route` cannot intercept the
 *    backend fetch (it is behind the RSC). With the seed DB empty, EVERY id (a
 *    random UUID OR a non-UUID string) resolves to the backend 400/404, which the
 *    data layer COLLAPSES to 'not_found' (REQ-09) → <PerfilNoEncontrado/>. We
 *    assert that runtime path here (ESC-UI-06, both branches).
 *  - The successful profile render (ESC-UI-05: services / reviews / no contact /
 *    CTA) and the profile network/5xx error state (ESC-UI-07) require a SEEDED
 *    provider in the backend, which is out of the verifier's scope; they are
 *    verified by runtime probe + documented in verify.md (same mock-vs-runtime
 *    split UC02 used for the cookie loop).
 */
import { expect, test } from "@playwright/test";

// ─── ESC-UI-06 — Perfil inexistente / id inválido → "No encontramos este prestador" ─

test.describe("ESC-UI-06 — Perfil inexistente o id inválido", () => {
  test("UUID inexistente (404) → pantalla 'No encontramos este prestador' + CTA a /prestadores", async ({
    page,
  }) => {
    // REQ-09. Random UUID → backend 404/400 → collapsed to not_found.
    await page.goto("/prestadores/11111111-1111-1111-1111-111111111111");

    await expect(page.locator("body")).toContainText("No encontramos este prestador.");
    // No technical detail leaks.
    await expect(page.locator("body")).not.toContainText(/stack|trace|Error:|statusCode/i);
    await expect(page.locator('[data-slot="alert"][role="alert"]')).toHaveCount(0);

    // CTA back to the search.
    const cta = page.locator('a[href="/prestadores"]').filter({
      hasText: /Volver a la búsqueda/i,
    });
    await expect(cta.first()).toBeVisible();
  });

  test("id NO-UUID (400) se comporta como inexistente (mismo screen, sin detalle)", async ({
    page,
  }) => {
    // REQ-09 — 400 (invalid uuid) collapses to the SAME not-found screen.
    await page.goto("/prestadores/not-a-uuid");

    await expect(page.locator("body")).toContainText("No encontramos este prestador.");
    await expect(page.locator("body")).not.toContainText(/uuid|Bad Request|statusCode/i);
    await expect(
      page.locator('a[href="/prestadores"]').filter({ hasText: /Volver a la búsqueda/i }).first(),
    ).toBeVisible();
  });

  test("la CTA 'Volver a la búsqueda' navega de vuelta al listado", async ({ page }) => {
    await page.goto("/prestadores/not-a-uuid");
    await page
      .locator('a[href="/prestadores"]')
      .filter({ hasText: /Volver a la búsqueda/i })
      .first()
      .click();
    await page.waitForURL(/\/prestadores$/, { timeout: 10000 });
    await page.waitForSelector("form[novalidate]", { state: "visible" });
  });
});

// ─── REQ-10 / RN-CAT-05 — el perfil es público y NO expone contacto ─────────────

test.describe("REQ-10 / RN-CAT-05 — perfil público sin datos de contacto", () => {
  test("/prestadores/:id accesible sin sesión (no redirige a /login)", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto("/prestadores/11111111-1111-1111-1111-111111111111");
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("la pantalla del perfil NUNCA muestra teléfono/email (RN-CAT-05)", async ({
    page,
  }) => {
    // Even the not-found screen must not leak contact channels; the success
    // screen cannot leak them because PrestadorPerfil does not declare them
    // (enforced at the type level, verified by tsc).
    await page.goto("/prestadores/11111111-1111-1111-1111-111111111111");
    const body = page.locator("body");
    // No phone-like or email-like contact data.
    await expect(body).not.toContainText(/\+?54\s?9?\d{8,}/); // AR phone shape
    await expect(body).not.toContainText(/@[a-z0-9.-]+\.[a-z]{2,}/i); // email shape
  });
});
