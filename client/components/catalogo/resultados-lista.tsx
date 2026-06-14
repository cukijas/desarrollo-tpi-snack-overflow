import { copy } from "@/lib/copy/es-AR";
import type {
  CriteriosBusqueda,
  PaginatedResult,
  PrestadorResumen,
} from "@/lib/catalogo/tipos";
import { PrestadorCard } from "@/components/catalogo/prestador-card";
import { Paginacion } from "@/components/catalogo/paginacion";

/**
 * Results list (Server Component, REQ-05/06, ESC-UI-01). Receives data already
 * resolved by the page (no fetch of its own). Renders the total, a responsive
 * grid of <PrestadorCard/> and <Paginacion/>.
 */
interface ResultadosListaProps {
  criterios: CriteriosBusqueda;
  resultado: PaginatedResult<PrestadorResumen>;
}

export function ResultadosLista({
  criterios,
  resultado,
}: ResultadosListaProps) {
  const { data, total } = resultado;

  const totalLabel = (
    total === 1
      ? copy.catalogo.resultados.totalSingular
      : copy.catalogo.resultados.totalPlural
  ).replace("{total}", total.toLocaleString("es-AR"));

  return (
    <div className="flex flex-col gap-6">
      <p
        className="text-sm font-medium text-muted-foreground"
        aria-live="polite"
      >
        {totalLabel}
      </p>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((prestador) => (
          <li key={prestador.id}>
            <PrestadorCard prestador={prestador} />
          </li>
        ))}
      </ul>

      <Paginacion criterios={criterios} total={total} />
    </div>
  );
}
