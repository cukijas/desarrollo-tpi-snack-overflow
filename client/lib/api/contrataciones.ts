/**
 * Hiring request API client (ADR-07-03, REQ-05..11). Mirrors the discriminated
 * `*-Result` pattern of lib/api/auth.ts and lib/api/catalogo.ts: every HTTP
 * outcome maps to `{ ok:true, data } | { ok:false, kind }` and the function
 * NEVER throws for business 4xx.
 *
 * Transport: the browser POSTs to the SAME-ORIGIN relative path
 * `/api/contrataciones` (the Next Route Handler / BFF), which attaches the
 * session Bearer server-side. The token is NEVER visible to this layer (REQ-04).
 *
 * OCL invariants:
 *  - `crearSolicitud` NEVER throws for 4xx (only transport → 'network').
 *  - 201 ⇒ `{ ok:true, data.estado: 'solicitada' }`.
 *  - The payload NEVER includes `clienteId` — the backend derives it from the
 *    token. The `CrearContratacionPayload` type does not even declare it.
 *  - No `kind` exposes backend traces / internal detail (REQ-11).
 */
import type { BackendValidationError } from "@/lib/api/auth";

/**
 * EXACT mirror of the backend `CreateContratacionDto`. `clienteId` is
 * DELIBERATELY absent — the backend derives it from the session token (REQ-04).
 */
export interface CrearContratacionPayload {
  ubicacion: string;
  prestadorId: string; // UUID v4 from the profile context (not user-editable)
  fecha: string; // ISO date `YYYY-MM-DD`, today or future
  franja: string; // free text (curated set in copy; backend validates availability)
  descripcion: string;
}

/** EXACT mirror of the backend `ContratacionResponseDto` (HTTP 201). */
export interface ContratacionResponse {
  id: string;
  ubicacion: string;
  prestadorId: string;
  clienteId: string; // present in the RESPONSE (set by the backend), not the payload
  fecha: string;
  franja: string;
  descripcion: string;
  estado: "solicitada";
  createdAt: string;
}

/**
 * Discriminated result consumed by the form. Never thrown for business 4xx.
 * The `unauthorized` kind is the ONLY one the form treats as "no session"
 * (→ redirect to /login). `franja_ocupada` (409) is an EXPECTED concurrency
 * outcome (RF-4.2), not a system failure (REQ-09).
 */
export type CrearSolicitudResult =
  | { ok: true; data: ContratacionResponse } // 201
  | { ok: false; kind: "unauthorized" } // 401 → form redirects to /login?next=
  | { ok: false; kind: "forbidden" } // 403 (non-cliente; prevented client-side)
  | { ok: false; kind: "prestador_no_disponible" } // 404
  | { ok: false; kind: "franja_ocupada" } // 409 (expected, actionable)
  | { ok: false; kind: "fecha_invalida" } // 422 (date in the past)
  | { ok: false; kind: "validation"; raw: BackendValidationError } // 400
  | { ok: false; kind: "network" } // transport failure
  | { ok: false; kind: "server"; status: number }; // 5xx / 502 / unexpected

const ENDPOINT = "/api/contrataciones";

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Create a hiring request.
 *
 * Preconditions (caller-enforced via zod, ADR-07-05): all fields non-empty,
 * `fecha` today or future, `prestadorId` from the profile context.
 *
 * Postconditions (OCL / ADR-07-03): 201 → `{ ok:true, data }`; 401 →
 * 'unauthorized'; 403 → 'forbidden'; 404 → 'prestador_no_disponible'; 409 →
 * 'franja_ocupada'; 422 → 'fecha_invalida'; 400 → 'validation'; 5xx/502/other →
 * 'server'; transport failure → 'network'. Never throws for 4xx.
 */
export async function crearSolicitud(
  payload: CrearContratacionPayload,
): Promise<CrearSolicitudResult> {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, kind: "network" };
  }

  if (response.status === 201) {
    const data = (await safeJson(response)) as ContratacionResponse | null;
    if (!data || typeof data !== "object" || data.estado !== "solicitada") {
      // A 201 without a usable body is an unexpected server condition.
      return { ok: false, kind: "server", status: response.status };
    }
    return { ok: true, data };
  }

  if (response.status === 401) return { ok: false, kind: "unauthorized" };
  if (response.status === 403) return { ok: false, kind: "forbidden" };
  if (response.status === 404) {
    return { ok: false, kind: "prestador_no_disponible" };
  }
  if (response.status === 409) return { ok: false, kind: "franja_ocupada" };
  if (response.status === 422) return { ok: false, kind: "fecha_invalida" };

  if (response.status === 400) {
    const raw = (await safeJson(response)) as BackendValidationError | null;
    return {
      ok: false,
      kind: "validation",
      raw: raw ?? { statusCode: 422, message: [], error: "Unprocessable Entity" },
    };
  }

  // 5xx, 502 (handler→backend transport failure), or any other status.
  return { ok: false, kind: "server", status: response.status };
}
