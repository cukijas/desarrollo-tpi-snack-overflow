import type { Metadata } from "next";

import { copy } from "@/lib/copy/es-AR";
import { obtenerPerfil } from "@/lib/api/catalogo";
import { SolicitudForm } from "@/components/catalogo/solicitud/solicitud-form";
import { PerfilNoEncontrado } from "@/components/catalogo/perfil/perfil-no-encontrado";
import { EstadoError } from "@/components/catalogo/estado-error";

export const metadata: Metadata = {
  title: `${copy.solicitud.title} · ${copy.app.title}`,
  description: copy.app.description,
};

// Reads the session cookie via the form's call path — never prerender it.
export const dynamic = "force-dynamic";

/**
 * Protected hiring request page (Server Component, ADR-07-02, REQ-02/04/14).
 *
 * Route group `(protegido)` + the `proxy.ts` matcher guarantee a valid session
 * BEFORE this renders (an anonymous deep-link is redirected to /login at the
 * edge). `await params` → id; we fetch the public profile to show a READABLE
 * target (name/oficios) so the client confirms who they are requesting (REQ-02),
 * then render the client `<SolicitudForm/>`.
 *
 * If the profile 404s (provider gone between profile and form) we show the same
 * not-found screen as UC04 instead of an empty form.
 */
export default async function SolicitarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const perfil = await obtenerPerfil(id);

  if (!perfil.ok && perfil.kind === "not_found") {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <PerfilNoEncontrado />
      </div>
    );
  }

  if (!perfil.ok) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <EstadoError />
      </div>
    );
  }

  const { nombreCompleto, oficios } = perfil.data;
  const oficioLegible = oficios.length > 0 ? ` · ${oficios.join(", ")}` : "";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">
          {copy.solicitud.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {copy.solicitud.paraPrestador.replace("{prestador}", nombreCompleto)}
          {oficioLegible}
        </p>
      </header>

      <SolicitudForm prestadorId={id} />
    </div>
  );
}
