"use client";

/**
 * "Solicitar" CTA (client, ADR-04-06, REQ-08, S5) — PLACEHOLDER entry point to
 * the future hiring flow (UC07/UC08). It does NOT create a contratación here.
 *
 * - Anonymous → navigates to /login?next=/prestadores/{id} (reuses the UC02
 *   `next` pattern; hiring will require a session).
 * - Authenticated → shows a polite "Próximamente" notice (UC07/08 not built).
 *
 * Tagged `data-feature="uc07-uc08"` to trace the dependency.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { copy } from "@/lib/copy/es-AR";
import { useSession } from "@/lib/session/session-context";

export function SolicitarCta({ prestadorId }: { prestadorId: string }) {
  const router = useRouter();
  const { status } = useSession();
  const [showNotice, setShowNotice] = useState(false);

  function onClick() {
    if (status === "authenticated") {
      // UC07/08 not implemented yet — communicate, do not pretend.
      setShowNotice(true);
      return;
    }
    router.push(`/login?next=/prestadores/${prestadorId}`);
  }

  return (
    <div className="flex flex-col gap-2" data-feature="uc07-uc08">
      <Button type="button" size="lg" onClick={onClick} className="w-full sm:w-auto">
        {copy.catalogo.perfil.solicitar}
      </Button>
      {showNotice && (
        <Alert variant="info" role="status">
          {copy.catalogo.perfil.solicitarProximamente}
        </Alert>
      )}
    </div>
  );
}
