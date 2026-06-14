import Link from "next/link";
import { MapPin } from "lucide-react";

import { copy } from "@/lib/copy/es-AR";
import type { PrestadorResumen } from "@/lib/catalogo/tipos";
import { AvatarPrestador } from "@/components/catalogo/avatar-prestador";
import { InsigniasPrestador } from "@/components/catalogo/insignias-prestador";
import { RatingDisplay } from "@/components/catalogo/rating-display";
import { DisponibilidadBadge } from "@/components/catalogo/disponibilidad-badge";

/**
 * Result card (Server Component, REQ-03/REQ-11, ESC-UI-01). The whole card is a
 * single <Link> to /prestadores/:id — keyboard-navigable with native focus.
 *
 * Layout (DESIGN-SYSTEM §5.3 "card resumen de prestador"): a header row with the
 * fallback avatar (§5.11) + name + accessible rating; a prominent trust-badges
 * row (§5.6 — the marketplace trust signal); oficio chips; and a footer with the
 * availability badge + distance. Hover lifts the card (`shadow-md` +
 * `-translate-y-0.5`, §5.3). Everything derives from EXISTING data — no photos,
 * no fabricated fields. Min height keeps a >=44px touch target (§8).
 */
export function PrestadorCard({ prestador }: { prestador: PrestadorResumen }) {
  const {
    id,
    nombreCompleto,
    oficios,
    calificacionPromedio,
    cantidadResenas,
    disponibilidad,
    proximaFechaDisponible,
    distanciaKm,
  } = prestador;

  return (
    <Link
      href={`/prestadores/${id}`}
      className="flex min-h-[44px] flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm transition-[box-shadow,transform,border-color] hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div className="flex items-start gap-3">
        <AvatarPrestador nombreCompleto={nombreCompleto} tamano="md" decorativo />
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="truncate text-base font-semibold text-foreground">
            {nombreCompleto}
          </h3>
          <RatingDisplay
            valor={calificacionPromedio}
            cantidadResenas={cantidadResenas}
          />
        </div>
      </div>

      <InsigniasPrestador prestador={prestador} />

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

      <div className="flex flex-wrap items-center gap-2">
        <DisponibilidadBadge
          disponibilidad={disponibilidad}
          proximaFechaDisponible={proximaFechaDisponible}
        />
        {typeof distanciaKm === "number" && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            {copy.catalogo.resultados.distancia.replace(
              "{km}",
              distanciaKm.toLocaleString("es-AR", {
                maximumFractionDigits: 1,
              }),
            )}
          </span>
        )}
      </div>
    </Link>
  );
}
