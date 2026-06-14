import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { copy } from "@/lib/copy/es-AR";
import type { CriteriosBusqueda } from "@/lib/catalogo/tipos";
import { criteriosToQueryString } from "@/lib/catalogo/query-params";

/**
 * Pagination (Server Component with <Link>, REQ-06, ESC-UI-04). Keyboard
 * navigable; the active page carries `aria-current="page"`. Each link preserves
 * the current query (oficio/ubicacion/filters/order) and only changes `page`.
 */
interface PaginacionProps {
  criterios: CriteriosBusqueda;
  total: number;
}

function href(criterios: CriteriosBusqueda, page: number): string {
  const qs = criteriosToQueryString({ ...criterios, page });
  return `/prestadores?${qs}`;
}

export function Paginacion({ criterios, total }: PaginacionProps) {
  const pageSize = criterios.pageSize ?? 20;
  const current = criterios.page ?? 1;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (totalPages <= 1) return null;

  // Compact window of page numbers around the current page.
  const pages: number[] = [];
  const from = Math.max(1, current - 2);
  const to = Math.min(totalPages, current + 2);
  for (let p = from; p <= to; p++) pages.push(p);

  const linkBase =
    "inline-flex h-11 min-w-11 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:h-10 md:min-w-10";

  return (
    <nav
      aria-label={copy.catalogo.paginacion.label}
      className="flex flex-wrap items-center justify-center gap-1.5"
    >
      {current > 1 ? (
        <Link
          href={href(criterios, current - 1)}
          rel="prev"
          aria-label={copy.catalogo.paginacion.anterior}
          className={cn(linkBase, "border-border-strong bg-surface hover:bg-surface-sunken")}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <span
          aria-hidden="true"
          className={cn(linkBase, "cursor-not-allowed border-border bg-surface-sunken text-muted-foreground opacity-50")}
        >
          <ChevronLeft className="size-4" />
        </span>
      )}

      {pages.map((p) => {
        const isCurrent = p === current;
        return (
          <Link
            key={p}
            href={href(criterios, p)}
            aria-current={isCurrent ? "page" : undefined}
            aria-label={
              isCurrent
                ? copy.catalogo.paginacion.paginaActual.replace("{n}", String(p))
                : copy.catalogo.paginacion.irAPagina.replace("{n}", String(p))
            }
            className={cn(
              linkBase,
              isCurrent
                ? "border-primary bg-primary text-on-primary"
                : "border-border-strong bg-surface hover:bg-surface-sunken",
            )}
          >
            {p}
          </Link>
        );
      })}

      {current < totalPages ? (
        <Link
          href={href(criterios, current + 1)}
          rel="next"
          aria-label={copy.catalogo.paginacion.siguiente}
          className={cn(linkBase, "border-border-strong bg-surface hover:bg-surface-sunken")}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <span
          aria-hidden="true"
          className={cn(linkBase, "cursor-not-allowed border-border bg-surface-sunken text-muted-foreground opacity-50")}
        >
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
