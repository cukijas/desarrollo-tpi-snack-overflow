import { describe, it, expect, vi, afterEach } from "vitest";
import { buscarPrestadores, obtenerPerfil } from "@/lib/api/catalogo";
import type { CriteriosBusqueda } from "@/lib/catalogo/tipos";

function makeResponse(status: number, body: unknown, rejectJson = false): Response {
  return {
    status,
    json: rejectJson
      ? () => Promise.reject(new SyntaxError("bad json"))
      : () => Promise.resolve(body),
  } as unknown as Response;
}

const CRITERIOS: CriteriosBusqueda = {
  oficio: "electricista",
  ubicacion: "Posadas",
};

const PAGINATED = {
  data: [
    {
      id: "1",
      nombreCompleto: "Ana López",
      oficios: ["electricista"],
      calificacionPromedio: 4.5,
      cantidadResenas: 12,
      disponibilidad: "disponible_esta_semana",
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("buscarPrestadores", () => {
  it("200 with valid shape → { ok:true, data } (Q1)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse(200, PAGINATED)));
    const result = await buscarPrestadores(CRITERIOS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.total).toBe(1);
      expect(result.data.data).toHaveLength(1);
    }
  });

  it("200 with data:[] → { ok:true } NEVER error (Q2, geocoding-fail + no results)", async () => {
    const empty = { data: [], total: 0, page: 1, pageSize: 20 };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse(200, empty)));
    const result = await buscarPrestadores(CRITERIOS);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.total).toBe(0);
  });

  it("200 with body missing pagination keys → 'server' (Q4)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse(200, { foo: "bar" })));
    const result = await buscarPrestadores(CRITERIOS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("server");
  });

  it("200 with unparseable body → 'server' (Q4)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse(200, null, true)));
    const result = await buscarPrestadores(CRITERIOS);
    if (!result.ok) expect(result.kind).toBe("server");
  });

  it("400 → 'bad_request' (Q3, never throws — Q6)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse(400, { message: "El oficio es obligatorio" })));
    const result = await buscarPrestadores(CRITERIOS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("bad_request");
  });

  it("500 → 'server' with status (Q4)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse(500, null)));
    const result = await buscarPrestadores(CRITERIOS);
    if (!result.ok && result.kind === "server") expect(result.status).toBe(500);
  });

  it("transport failure → 'network' (Q5, never throws — Q6)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const result = await buscarPrestadores(CRITERIOS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("network");
  });

  it("fetches the ABSOLUTE backend URL, NOT the relative /api path (S1)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, PAGINATED));
    vi.stubGlobal("fetch", fetchMock);
    await buscarPrestadores(CRITERIOS);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/^https?:\/\/.+\/catalogo\/prestadores/);
    expect(url).not.toMatch(/^\/api\//);
    expect(url).toContain("oficio=electricista");
    expect(url).toContain("ubicacion=Posadas");
  });

  it("uses cache:'no-store'", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, PAGINATED));
    vi.stubGlobal("fetch", fetchMock);
    await buscarPrestadores(CRITERIOS);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.cache).toBe("no-store");
  });
});

describe("obtenerPerfil", () => {
  const PERFIL = {
    id: "abc",
    nombreCompleto: "Ana López",
    oficios: ["electricista"],
    calificacionPromedio: 4.5,
    cantidadResenas: 12,
    zonaCobertura: ["Posadas"],
    servicios: [],
    resenas: [],
  };

  it("200 → { ok:true, data } with NO contact info (Q1, RN-CAT-05)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse(200, PERFIL)));
    const result = await obtenerPerfil("abc");
    expect(result.ok).toBe(true);
    if (result.ok) {
      const serialized = JSON.stringify(result.data).toLowerCase();
      expect(serialized).not.toMatch(/tel[eé]fono|phone|e-?mail/);
    }
  });

  it("404 → 'not_found' (Q2, never throws — Q5)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse(404, { message: "Prestador no encontrado" })));
    const result = await obtenerPerfil("abc");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("not_found");
  });

  it("400 (invalid id) → 'not_found' (Q3, deliberate collapse)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse(400, { message: "id must be a UUID" })));
    const result = await obtenerPerfil("not-a-uuid");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("not_found");
      // Backend detail must not leak through the result.
      expect(JSON.stringify(result).toLowerCase()).not.toContain("uuid");
    }
  });

  it("500 → 'server' (Q4)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse(500, null)));
    const result = await obtenerPerfil("abc");
    if (!result.ok) expect(result.kind).toBe("server");
  });

  it("transport failure → 'network' (Q4)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("down")));
    const result = await obtenerPerfil("abc");
    if (!result.ok) expect(result.kind).toBe("network");
  });

  it("fetches the ABSOLUTE backend URL with the id path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, PERFIL));
    vi.stubGlobal("fetch", fetchMock);
    await obtenerPerfil("abc");
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toMatch(/^https?:\/\/.+\/catalogo\/prestadores\/abc$/);
  });
});
