/**
 * Route protection (design §6.3, REQ-07, ESC-UI-07, Supuesto S3).
 *
 * NOTE (Next 16 breaking change): the `middleware` file convention is
 * deprecated and RENAMED to `proxy` (see node_modules/next/dist/docs/.../
 * proxy.md §"Migration to Proxy"). The design predates this rename and refers
 * to `middleware.ts`; functionally identical, just the new file/function name.
 * Proxy now defaults to the Node.js runtime, so the JWT `exp` check runs fine.
 *
 * Logic: read the session cookie; if a PROTECTED path has no cookie or an
 * expired token, redirect 307 to /login?next=<original pathname>. Public paths
 * always pass through. The matcher is conservative: the placeholder account
 * area `/cuenta/*` plus the UC07 hiring request form
 * `/prestadores/:id/solicitar` (ADR-07-02). Everything else public (home,
 * login, registro, recuperación, assets, /api/*, AND the public provider
 * profile `/prestadores/:id`) is untouched.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/session/cookie";
import { isExpired } from "@/lib/session/jwt";

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const hasValidSession = typeof token === "string" && !isExpired(token);

  if (hasValidSession) {
    return NextResponse.next();
  }

  // No valid session on a protected path (only `/cuenta/*` matches today):
  // redirect to /login preserving the original path as a safe `next` target.
  const loginUrl = new URL("/login", request.url);
  // `pathname` from nextUrl is always an internal absolute path → safe to pass.
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl, 307);
}

export const config = {
  // Protect the account area and the UC07 hiring request form (ADR-07-02, S2).
  // Two EXPLICIT entries: the literal `/solicitar` suffix means the public
  // provider profile `/prestadores/:id` does NOT match (it has no `/solicitar`
  // suffix) and stays accessible without a session. Everything else public
  // (home, auth, assets, /api/*) is implicitly excluded by not matching.
  matcher: ["/cuenta/:path*", "/prestadores/:id/solicitar"],
};
