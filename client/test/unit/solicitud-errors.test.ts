import { describe, it, expect } from "vitest";
import { mapSolicitudError } from "@/lib/errors/field-errors";
import { copy } from "@/lib/copy/es-AR";

describe("mapSolicitudError (REQ-07..11)", () => {
  it("401 → redirect, no visible message", () => {
    const m = mapSolicitudError({ ok: false, kind: "unauthorized" });
    expect(m.redirect).toBe(true);
    expect(m.banner).toBeUndefined();
  });

  it("409 → actionable banner + reselect franja, keeps the rest of the data", () => {
    const m = mapSolicitudError({ ok: false, kind: "franja_ocupada" });
    expect(m.reselectFranja).toBe(true);
    expect(m.banner).toBe(copy.solicitud.franjaOcupada);
    expect(m.field?.key).toBe("franja");
  });

  it("404 → 'no disponible' banner + Volver a la búsqueda flag", () => {
    const m = mapSolicitudError({ ok: false, kind: "prestador_no_disponible" });
    expect(m.banner).toBe(copy.solicitud.noDisponible);
    expect(m.noDisponible).toBe(true);
  });

  it("422 → inline under Fecha (no banner)", () => {
    const m = mapSolicitudError({ ok: false, kind: "fecha_invalida" });
    expect(m.field?.key).toBe("fecha");
    expect(m.field?.message).toBe(copy.solicitud.errors.fechaPasada);
    expect(m.banner).toBeUndefined();
  });

  it("400 → generic validation summary banner", () => {
    const m = mapSolicitudError({
      ok: false,
      kind: "validation",
      raw: { statusCode: 422, message: [], error: "Unprocessable Entity" },
    });
    expect(m.banner).toBe(copy.solicitud.validacionGenerica);
  });

  it("403 → generic 'solo clientes' message (last-resort)", () => {
    const m = mapSolicitudError({ ok: false, kind: "forbidden" });
    expect(m.banner).toBe(copy.solicitud.cta.prestador);
  });

  it("network → non-technical banner, no traces", () => {
    const m = mapSolicitudError({ ok: false, kind: "network" });
    expect(m.banner).toBe(copy.solicitud.redServer);
  });

  it("server → non-technical banner, no traces", () => {
    const m = mapSolicitudError({ ok: false, kind: "server", status: 500 });
    expect(m.banner).toBe(copy.solicitud.redServer);
    expect(JSON.stringify(m)).not.toContain("500");
  });
});
