/**
 * Hiring request success panel (REQ-05, ESC-UI-01). Shown after a 201. The form
 * stays locked (no resend); this communicates the next step and offers a CTA
 * back to the provider profile.
 *
 * It does NOT navigate to the client inbox (MI-09.3 is out of scope) — the post
 * success landing is the provider profile (ADR / spec §"Aterrizaje post-201").
 */
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy/es-AR";

export function SolicitudExito({ prestadorId }: { prestadorId: string }) {
  return (
    <div
      role="status"
      className="flex flex-col items-start gap-4 rounded-md border border-success/40 bg-success-subtle p-6"
    >
      <div className="flex items-center gap-2 text-success">
        <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
        <h2 className="text-lg font-semibold">{copy.solicitud.exitoTitulo}</h2>
      </div>
      <p className="text-sm text-foreground">{copy.solicitud.exito}</p>
      <Button asChild size="lg" variant="outline">
        <Link href={`/prestadores/${prestadorId}`}>
          {copy.solicitud.volverAlPerfil}
        </Link>
      </Button>
    </div>
  );
}
