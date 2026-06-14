import type { Metadata } from "next";

import { copy } from "@/lib/copy/es-AR";
import { obtenerPerfil } from "@/lib/api/catalogo";
import { PerfilPrestador } from "@/components/catalogo/perfil/perfil-prestador";
import { PerfilNoEncontrado } from "@/components/catalogo/perfil/perfil-no-encontrado";
import { EstadoError } from "@/components/catalogo/estado-error";

export const metadata: Metadata = {
  title: `${copy.app.title}`,
  description: copy.app.description,
};

// The profile is dynamic and fetched per-request with no-store.
export const dynamic = "force-dynamic";

/**
 * Public provider profile page (Server Component, REQ-07/09, ESC-UI-05/06/07).
 * `await params.id` → obtenerPerfil server-side:
 *   ok          → <PerfilPrestador/>
 *   not_found   → <PerfilNoEncontrado/> (NOT notFound(), to control the es-AR copy)
 *   network|server → <EstadoError/>
 */
export default async function PerfilPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await obtenerPerfil(id);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      {res.ok ? (
        <PerfilPrestador data={res.data} />
      ) : res.kind === "not_found" ? (
        <PerfilNoEncontrado />
      ) : (
        <EstadoError />
      )}
    </div>
  );
}
