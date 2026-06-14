import { copy } from "@/lib/copy/es-AR";
import type { Servicio } from "@/lib/catalogo/tipos";

/**
 * Service item (Server Component, REQ-07, ESC-UI-05): categoría + descripción +
 * price range min–max. Either bound may be null → renders an open range or a
 * "Precio a consultar" fallback.
 */
function formatPrecio(min: number | null, max: number | null): string {
  const fmt = (n: number) => n.toLocaleString("es-AR");
  if (min !== null && max !== null) {
    return copy.catalogo.perfil.precioRango
      .replace("{min}", fmt(min))
      .replace("{max}", fmt(max));
  }
  if (min !== null) {
    return copy.catalogo.perfil.precioDesde.replace("{min}", fmt(min));
  }
  if (max !== null) {
    return copy.catalogo.perfil.precioHasta.replace("{max}", fmt(max));
  }
  return copy.catalogo.perfil.precioConsultar;
}

export function ServicioItem({ servicio }: { servicio: Servicio }) {
  const { categoria, descripcion, rangoPrecio } = servicio;

  return (
    <li className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">{categoria}</h3>
        <span className="text-sm font-medium text-foreground">
          {formatPrecio(rangoPrecio.min, rangoPrecio.max)}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{descripcion}</p>
    </li>
  );
}
