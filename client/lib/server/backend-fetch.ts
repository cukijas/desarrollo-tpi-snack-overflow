/**
 * [CENTRAL — REUSABLE] Server-only authenticated backend forwarder
 * (ADR-07-01, REQ-04, RNF-S.1/S.4).
 *
 * The backend reads `Authorization: Bearer <token>` but the token lives in the
 * httpOnly `so_session` cookie (precedent UC02), which browser JS can never
 * read. The blind `/api/:path*` rewrite in next.config.ts forwards bodies but
 * cannot read the cookie or set headers. This helper closes that gap: it runs
 * SERVER-SIDE only, reads the cookie, validates `exp`, attaches the Bearer
 * header and forwards to the backend — the token travels server→server and is
 * NEVER exposed to the client bundle.
 *
 * `import "server-only"` makes importing this from a Client Component a BUILD
 * ERROR — that is the security guarantee, not a runtime check.
 *
 * Scope of responsibility (DELIBERATELY narrow so it stays reusable):
 *  - It owns ONLY the cookie→Bearer concern and the transport to the backend.
 *  - It does NOT map status codes to UX — that lives in the Route Handler /
 *    api-client (ADR-07-03). It returns the backend `Response` verbatim
 *    (including any 4xx/5xx) so each caller maps it.
 *  - Missing/expired token short-circuits with the `{ unauthorized: true }`
 *    sentinel WITHOUT hitting the backend (RN-AUTH-06).
 *
 * Reuse: MI-08.2 (PATCH transitions) and MI-09.3 (GET listing) build a thin
 * Route Handler per resource on top of this exact helper — the signature is
 * intentionally stable.
 */
import "server-only";

import { readSessionToken } from "@/lib/session/cookie";
import { isExpired } from "@/lib/session/jwt";

/** Server-only backend base URL (same value the next.config.ts rewrite uses). */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

/**
 * Result of an authenticated backend call.
 *  - `{ unauthorized: true }`         → no cookie or `exp` expired; the backend
 *                                       was NOT called. The caller maps this to
 *                                       a 401 so the client redirects to login.
 *  - `{ unauthorized: false, response }` → the backend's raw `Response` (any
 *                                       status, including 4xx/5xx) for the
 *                                       caller to map.
 */
export type BackendFetchResult =
  | { unauthorized: true }
  | { unauthorized: false; response: Response };

/**
 * Forward `init` to `${BACKEND_URL}${path}` with the session Bearer token.
 *
 * Preconditions: `path` is an absolute backend path (e.g. `/contrataciones`).
 * Postconditions:
 *  - No token OR token expired → `{ unauthorized: true }`, backend NOT called.
 *  - Otherwise attaches `Authorization: Bearer <token>`, forces
 *    `cache: 'no-store'`, preserves caller headers/method/body, and returns
 *    `{ unauthorized: false, response }` with the backend status verbatim.
 *  - Transport failures are NOT caught here — the caller (Route Handler) owns
 *    the try/catch → 502 mapping, keeping this helper a pure forwarder.
 */
export async function backendFetch(
  path: string,
  init: RequestInit = {},
): Promise<BackendFetchResult> {
  const token = await readSessionToken();

  // No session or an expired token → never touch the backend (RN-AUTH-06).
  if (!token || isExpired(token)) {
    return { unauthorized: true };
  }

  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
    // Authenticated, per-user, mutating calls must never be cached.
    cache: "no-store",
  });

  return { unauthorized: false, response };
}
