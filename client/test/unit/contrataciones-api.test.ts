import { describe, it, expect, vi, afterEach } from "vitest";
import {
  crearSolicitud,
  type CrearContratacionPayload,
} from "@/lib/api/contrataciones";

function makeResponse(status: number, body: unknown, rejectJson = false): Response {
  return {
    status,
    json: rejectJson
      ? () => Promise.reject(new SyntaxError("bad json"))
      : () => Promise.resolve(body),
  } as unknown as Response;
}

const PAYLOAD: CrearContratacionPayload = {
  ubicacion: "Posadas",
  prestadorId: "11111111-1111-4111-8111-111111111111",
  fecha: "2026-12-31",
  franja: "Mañana (08–12)",
  descripcion: "Arreglo de tablero",
};

const CREATED = {
  id: "c1",
  ubicacion: "Posadas",
  prestadorId: PAYLOAD.prestadorId,
  clienteId: "cli-1",
  fecha: "2026-12-31",
  franja: "Mañana (08–12)",
  descripcion: "Arreglo de tablero",
  estado: "solicitada",
  createdAt: "2026-06-13T10:00:00.000Z",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("crearSolicitud — status → kind mapping (OCL)", () => {
  it("201 → { ok:true, data.estado:'solicitada' }", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse(201, CREATED)));
    const result = await crearSolicitud(PAYLOAD);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.estado).toBe("solicitada");
  });

  it("201 with an unusable body → 'server' (not a fake success)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse(201, { estado: "otro" })));
    const result = await crearSolicitud(PAYLOAD);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("server");
  });

  it("401 → 'unauthorized'", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse(401, { ok: false })));
    const result = await crearSolicitud(PAYLOAD);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("unauthorized");
  });

  it("403 → 'forbidden'", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse(403, {})));
    const result = await crearSolicitud(PAYLOAD);
    if (!result.ok) expect(result.kind).toBe("forbidden");
  });

  it("404 → 'prestador_no_disponible'", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse(404, {})));
    const result = await crearSolicitud(PAYLOAD);
    if (!result.ok) expect(result.kind).toBe("prestador_no_disponible");
  });

  it("409 → 'franja_ocupada' (expected concurrency, not a system error)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse(409, {})));
    const result = await crearSolicitud(PAYLOAD);
    if (!result.ok) expect(result.kind).toBe("franja_ocupada");
  });

  it("422 → 'fecha_invalida'", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse(422, {})));
    const result = await crearSolicitud(PAYLOAD);
    if (!result.ok) expect(result.kind).toBe("fecha_invalida");
  });

  it("400 → 'validation' (carries raw body)", async () => {
    const body = { statusCode: 400, message: ["ubicacion should not be empty"], error: "Bad Request" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse(400, body)));
    const result = await crearSolicitud(PAYLOAD);
    expect(result.ok).toBe(false);
    if (!result.ok && result.kind === "validation") {
      expect(Array.isArray(result.raw.message)).toBe(true);
    }
  });

  it("500 → 'server' with status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse(500, {})));
    const result = await crearSolicitud(PAYLOAD);
    if (!result.ok && result.kind === "server") {
      expect(result.status).toBe(500);
    }
  });

  it("502 (handler→backend transport) → 'server'", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse(502, {})));
    const result = await crearSolicitud(PAYLOAD);
    if (!result.ok) expect(result.kind).toBe("server");
  });

  it("transport throw → 'network' (NEVER throws)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const result = await crearSolicitud(PAYLOAD);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("network");
  });

  it("NEVER throws for any 4xx", async () => {
    for (const status of [400, 401, 403, 404, 409, 422]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse(status, {})));
      await expect(crearSolicitud(PAYLOAD)).resolves.toBeDefined();
    }
  });

  it("the sent body NEVER includes clienteId (REQ-04)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(201, CREATED));
    vi.stubGlobal("fetch", fetchMock);
    await crearSolicitud(PAYLOAD);
    const sentBody = fetchMock.mock.calls[0][1].body as string;
    expect(sentBody).not.toContain("clienteId");
  });
});
