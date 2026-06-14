import { SearchX } from "lucide-react";

import { copy } from "@/lib/copy/es-AR";

/**
 * Empty-results state (Server Component, ADR-04-04, REQ-05, ESC-UI-03, S4).
 *
 * NEUTRAL tone — NOT an error. Uses `role="status"` (polite), never
 * `role="alert"`. Interpolates {oficio}/{ubicacion} and ALWAYS includes the
 * location guidance, which covers both "no results" and "geocoding failed"
 * (the backend returns 200 data:[] for both and does not disambiguate, so we
 * never diagnose). The search form stays visible/editable above this.
 */
export function EstadoVacio({
  oficio,
  ubicacion,
}: {
  oficio: string;
  ubicacion: string;
}) {
  const titulo = copy.catalogo.vacio.titulo
    .replace("{oficio}", oficio)
    .replace("{ubicacion}", ubicacion);

  return (
    <div
      role="status"
      className="flex flex-col items-center gap-4 rounded-lg border border-border bg-surface px-6 py-12 text-center"
    >
      <SearchX
        className="size-10 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-foreground">{titulo}</p>
        <p className="text-sm text-muted-foreground">
          {copy.catalogo.vacio.cuerpo}
        </p>
      </div>
      <ul className="flex max-w-md flex-col gap-1.5 text-sm text-muted-foreground">
        <li>{copy.catalogo.vacio.cambiarOficio}</li>
        <li>{copy.catalogo.vacio.ampliarUbicacion}</li>
        <li>{copy.catalogo.vacio.quitarFiltros}</li>
        <li className="font-medium text-foreground">
          {copy.catalogo.vacio.guiaUbicacion}
        </li>
      </ul>
    </div>
  );
}
