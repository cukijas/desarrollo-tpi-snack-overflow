import Link from "next/link";
import { MapPin } from "lucide-react";

import { copy } from "@/lib/copy/es-AR";
import type { PrestadorResumen } from "@/lib/catalogo/tipos";
import { RatingDisplay } from "@/components/catalogo/rating-display";
import { DisponibilidadBadge } from "@/components/catalogo/disponibilidad-badge";

/**
 * Result card (Server Component, REQ-03/REQ-11, ESC-UI-01). The whole card is a
 * <Link> to /prestadores/:id — keyboard-navigable with native focus. Shows
 * name, oficio chips, rating (stars + accessible text), availability badge and
 * distance only when present. Min height keeps a ≥44px touch target.
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
      className="flex min-h-[44px] flex-col gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-foreground">
          {nombreCompleto}
        </h3>
        <RatingDisplay
          valor={calificacionPromedio}
          cantidadResenas={cantidadResenas}
        />
      </div>

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
