/**
 * Catalog read API client (ADR-04-02, design §3, OCL §8). Mirrors the
 * discriminated `*-Result` pattern of lib/api/auth.ts: every HTTP outcome maps
 * to `{ ok:true, data } | { ok:false, kind }` and the functions NEVER throw for
 * 4xx.
 *
 * Transport (S1, CRITICAL): these run SERVER-SIDE (from a Server Component),
 * where there is NO relative origin. They fetch the backend DIRECTLY via the
 * absolute `BACKEND_URL` (the same server-only env the rewrite uses), NOT the
 * relative `/api/...` path. `cache: 'no-store'` because results are dynamic per
 * query and must not be shared across users.
 */
import {
  type CriteriosBusqueda,
  type PaginatedResult,
  type PrestadorResumen,
  type PrestadorPerfil,
} from "@/lib/catalogo/tipos";
import { criteriosToQueryString } from "@/lib/catalogo/query-params";

/** Server-only backend base URL (same value as the next.config.ts rewrite). */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

/**
 * Discriminated search result — mirror of RegisterResult/LoginResult.
 * 200 (including data:[] / geocoding-fail) → ok. Never thrown for 4xx.
 */
export type BuscarResult =
  | { ok: true; data: PaginatedResult<PrestadorResumen> }
  | { ok: false; kind: "bad_request" } // 400 (guard ADR-04-03 should prevent it)
  | { ok: false; kind: "network" } // transport failed
  | { ok: false; kind: "server"; status: number }; // 5xx / invalid body / unexpected

/**
 * Discriminated profile result. 404 AND 400 (non-UUID id) BOTH collapse to
 * 'not_found' (REQ-09) — the backend detail is never exposed.
 */
export type PerfilResult =
  | { ok: true; data: PrestadorPerfil }
  | { ok: false; kind: "not_found" } // 404 or 400 (invalid id) → same screen
  | { ok: false; kind: "network" }
  | { ok: false; kind: "server"; status: number };

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** Minimal structural guard for a PaginatedResult body (OCL Q4). */
function isPaginatedResult(
  body: unknown,
): body is PaginatedResult<PrestadorResumen> {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    Array.isArray(b.data) &&
    typeof b.total === "number" &&
    typeof b.page === "number" &&
    typeof b.pageSize === "number"
  );
}

/**
 * Search providers. Runs SERVER-SIDE against `${BACKEND_URL}/catalogo/prestadores`.
 *
 * Preconditions (caller-enforced, ADR-04-03): oficio + ubicacion are non-empty.
 * Postconditions (OCL §8): 200 with valid shape → { ok:true, data } (total may
 * be 0; data:[] is NEVER an error — Q2); 400 → 'bad_request'; 5xx or body
 * missing {data,total,page,pageSize} → 'server'; transport failure → 'network'.
 * Never throws for 4xx.
 */
export async function buscarPrestadores(
  criterios: CriteriosBusqueda,
): Promise<BuscarResult> {
  const qs = criteriosToQueryString(criterios);
  const url = `${BACKEND_URL}/catalogo/prestadores${qs ? `?${qs}` : ""}`;

  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch {
    return { ok: false, kind: "network" };
  }

  if (response.status === 200) {
    const body = await safeJson(response);
    if (!isPaginatedResult(body)) {
      return { ok: false, kind: "server", status: response.status };
    }
    return { ok: true, data: body };
  }

  if (response.status === 400) {
    return { ok: false, kind: "bad_request" };
  }

  // 5xx or any other unexpected status.
  return { ok: false, kind: "server", status: response.status };
}

/**
 * Fetch a public provider profile. Runs SERVER-SIDE against
 * `${BACKEND_URL}/catalogo/prestadores/:id`.
 *
 * Preconditions: id is a non-empty string.
 * Postconditions (OCL §8): 200 → { ok:true, data } (data has NO contact info,
 * RN-CAT-05); 404 OR 400 (invalid id) → 'not_found' (deliberate collapse,
 * REQ-09); 5xx → 'server'; transport failure → 'network'. Never throws for 4xx.
 */
export async function obtenerPerfil(id: string): Promise<PerfilResult> {
  const url = `${BACKEND_URL}/catalogo/prestadores/${encodeURIComponent(id)}`;

  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch {
    return { ok: false, kind: "network" };
  }

  if (response.status === 200) {
    const body = (await safeJson(response)) as PrestadorPerfil | null;
    if (!body || typeof body !== "object") {
      return { ok: false, kind: "server", status: response.status };
    }
    return { ok: true, data: body };
  }

  // 404 (not found) and 400 (id is not a UUID) collapse to the same screen.
  if (response.status === 404 || response.status === 400) {
    return { ok: false, kind: "not_found" };
  }

  // 5xx or any other unexpected status.
  return { ok: false, kind: "server", status: response.status };
}
