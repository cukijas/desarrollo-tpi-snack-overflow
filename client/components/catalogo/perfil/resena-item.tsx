import { copy } from "@/lib/copy/es-AR";
import type { Resena } from "@/lib/catalogo/tipos";
import { RatingDisplay } from "@/components/catalogo/rating-display";
import { formatRating } from "@/lib/catalogo/rating";

/**
 * Review item (Server Component, REQ-07, ESC-UI-05): rating + contenido + fecha
 * + clienteNombre (falls back to a neutral label when absent). The date is
 * formatted in es-AR.
 */
function formatFecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function ResenaItem({ resena }: { resena: Resena }) {
  const { calificacion, contenido, fecha, clienteNombre } = resena;

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">
          {clienteNombre ?? copy.catalogo.perfil.clienteAnonimo}
        </span>
        <RatingDisplay
          valor={calificacion}
          cantidadResenas={0}
          compact
          ariaLabel={`${formatRating(calificacion)} de 5`}
        />
      </div>
      <p className="text-sm text-foreground">{contenido}</p>
      <time className="text-xs text-muted-foreground" dateTime={fecha}>
        {formatFecha(fecha)}
      </time>
    </li>
  );
}
