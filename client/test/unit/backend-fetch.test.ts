import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// `server-only` throws when imported outside an RSC graph; stub it for the test.
vi.mock("server-only", () => ({}));

const readSessionToken = vi.fn<() => Promise<string | undefined>>();
const isExpired = vi.fn<(token: string) => boolean>();

vi.mock("@/lib/session/cookie", () => ({
  readSessionToken: () => readSessionToken(),
}));
vi.mock("@/lib/session/jwt", () => ({
  isExpired: (token: string) => isExpired(token),
}));

// Import AFTER the mocks are registered.
import { backendFetch } from "@/lib/server/backend-fetch";

function makeResponse(status: number): Response {
  return { status, json: () => Promise.resolve({}) } as unknown as Response;
}

beforeEach(() => {
  readSessionToken.mockReset();
  isExpired.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("backendFetch", () => {
  it("no cookie → { unauthorized:true } WITHOUT calling fetch", async () => {
    readSessionToken.mockResolvedValue(undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await backendFetch("/contrataciones", { method: "POST" });

    expect(result.unauthorized).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("expired token → { unauthorized:true } WITHOUT calling fetch", async () => {
    readSessionToken.mockResolvedValue("expired.jwt");
    isExpired.mockReturnValue(true);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await backendFetch("/contrataciones");

    expect(result.unauthorized).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("valid token → attaches Bearer + cache:'no-store' and returns the response", async () => {
    readSessionToken.mockResolvedValue("good.jwt");
    isExpired.mockReturnValue(false);
    const backendResponse = makeResponse(201);
    const fetchMock = vi.fn().mockResolvedValue(backendResponse);
    vi.stubGlobal("fetch", fetchMock);

    const result = await backendFetch("/contrataciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    expect(result.unauthorized).toBe(false);
    if (!result.unauthorized) expect(result.response).toBe(backendResponse);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/contrataciones$/);
    expect(init.method).toBe("POST");
    expect(init.cache).toBe("no-store");
    expect(init.headers.Authorization).toBe("Bearer good.jwt");
    // Caller headers are preserved alongside the injected Authorization.
    expect(init.headers["Content-Type"]).toBe("application/json");
  });
});
