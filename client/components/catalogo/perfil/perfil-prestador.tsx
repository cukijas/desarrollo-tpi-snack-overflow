import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";

import { copy } from "@/lib/copy/es-AR";
import type { PrestadorPerfil } from "@/lib/catalogo/tipos";
import { RatingDisplay } from "@/components/catalogo/rating-display";
import { ServicioItem } from "@/components/catalogo/perfil/servicio-item";
import { ResenaItem } from "@/components/catalogo/perfil/resena-item";
import { SolicitarCta } from "@/components/catalogo/perfil/solicitar-cta";

/**
 * Public provider profile (Server Component, REQ-07/08, RN-CAT-05, ESC-UI-05).
 * Header (name, oficio chips, rating), coverage zone, services and reviews,
 * plus the "Solicitar" CTA. MUST NOT render phone/email — the PrestadorPerfil
 * type does not even declare them, so this is enforced at the type level.
 */
export function PerfilPrestador({ data }: { data: PrestadorPerfil }) {
  const {
    id,
    nombreCompleto,
    oficios,
    calificacionPromedio,
    cantidadResenas,
    zonaCobertura,
    servicios,
    resenas,
  } = data;

  return (
    <article className="flex flex-col gap-8">
      <Link
        href="/prestadores"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {copy.catalogo.perfil.volver}
      </Link>

      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold text-foreground">
          {nombreCompleto}
        </h1>
        {oficios.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {oficios.map((oficio) => (
              <li
                key={oficio}
                className="rounded-full bg-primary-subtle px-2.5 py-0.5 text-xs font-medium text-foreground"
              >
                {oficio}
              </li>
            ))}
          </ul>
        )}
        <RatingDisplay
          valor={calificacionPromedio}
          cantidadResenas={cantidadResenas}
        />
      </header>

      <SolicitarCta prestadorId={id} />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          {copy.catalogo.perfil.zonaTitulo}
        </h2>
        {zonaCobertura.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {zonaCobertura.map((zona) => (
              <li
                key={zona}
                className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
              >
                <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                {zona}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          {copy.catalogo.perfil.serviciosTitulo}
        </h2>
        {servicios.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {servicios.map((servicio) => (
              <ServicioItem key={servicio.id} servicio={servicio} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {copy.catalogo.perfil.sinServicios}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          {copy.catalogo.perfil.resenasTitulo}
        </h2>
        {resenas.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {resenas.map((resena, i) => (
              <ResenaItem key={`${resena.fecha}-${i}`} resena={resena} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {copy.catalogo.perfil.sinResenas}
          </p>
        )}
      </section>
    </article>
  );
}
