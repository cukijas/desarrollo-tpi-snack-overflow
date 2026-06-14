import Link from "next/link";
import { UserX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy/es-AR";

/**
 * Profile not-found screen (Server Component, REQ-09, ESC-UI-06). Shown for
 * both 404 and 400 (invalid id) — collapsed in the data layer. No technical
 * detail; offers a "Volver a la búsqueda" CTA → /prestadores.
 */
export function PerfilNoEncontrado() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-surface px-6 py-12 text-center">
      <UserX className="size-10 text-muted-foreground" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-foreground">
          {copy.catalogo.noEncontrado.titulo}
        </h1>
        <p className="text-sm text-muted-foreground">
          {copy.catalogo.noEncontrado.cuerpo}
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/prestadores">{copy.catalogo.perfil.volver}</Link>
      </Button>
    </div>
  );
}
