"use client";

/**
 * "Solicitar" CTA (client, ADR-07-04, REQ-01/07, ESC-UI-02, REQ-13) — entry
 * point to the UC07 hiring flow. It does NOT create a contratación here; it
 * routes to the protected request form (proxy.ts + backend enforce auth/role —
 * the role read here is decorative, NOT authorization, ADR-07-04).
 *
 * Three branches by session/role (REQ-01):
 *  - cliente + authenticated → push to /prestadores/{id}/solicitar.
 *  - anonymous               → push to /login?next=/prestadores/{id}/solicitar
 *                              (preserves the destination to resume after login).
 *  - prestador               → CTA disabled with an SR-perceivable explanation
 *                              (a provider cannot hire; mirrors the backend 403).
 */
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy/es-AR";
import { useSession } from "@/lib/session/session-context";

export function SolicitarCta({ prestadorId }: { prestadorId: string }) {
  const router = useRouter();
  const { status, user } = useSession();

  const destino = `/prestadores/${prestadorId}/solicitar`;
  const isPrestador = status === "authenticated" && user?.role === "prestador";
  const noticeId = `solicitar-cta-notice-${prestadorId}`;

  function onClick() {
    if (status === "authenticated") {
      // cliente (or any non-prestador authenticated role) → open the form.
      router.push(destino);
      return;
    }
    // Anonymous → login, preserving the destination to resume after auth.
    router.push(`/login?next=${encodeURIComponent(destino)}`);
  }

  if (isPrestador) {
    // Disabled with a perceivable explanation (REQ-01/07/13) — NOT color-only.
    return (
      <div className="flex flex-col gap-2" data-feature="uc07">
        <Button
          type="button"
          size="lg"
          disabled
          aria-disabled="true"
          aria-describedby={noticeId}
          className="w-full sm:w-auto"
        >
          {copy.catalogo.perfil.solicitar}
        </Button>
        <p id={noticeId} className="text-sm text-muted-foreground">
          {copy.solicitud.cta.prestador}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-feature="uc07">
      <Button
        type="button"
        size="lg"
        onClick={onClick}
        className="w-full sm:w-auto"
      >
        {copy.catalogo.perfil.solicitar}
      </Button>
      {status !== "authenticated" && (
        <p className="text-sm text-muted-foreground">
          {copy.solicitud.cta.anonimo}
        </p>
      )}
    </div>
  );
}
