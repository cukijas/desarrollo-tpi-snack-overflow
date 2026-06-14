import { Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { copy } from "@/lib/copy/es-AR";
import { formatRating, ratingAccesible } from "@/lib/catalogo/rating";

/**
 * Accessible rating (Server Component, ADR-04-05, REQ-03/REQ-11). The five
 * stars are DECORATIVE (`aria-hidden`); the accessible text is ALWAYS present,
 * so the screen reader never depends on counting stars. The visible number
 * uses the es-AR decimal comma.
 */
interface RatingDisplayProps {
  valor: number;
  cantidadResenas: number;
  /** Hide the trailing visible "(N reseñas)" while keeping the aria text. */
  compact?: boolean;
  /** Override the accessible label (e.g. a single review's rating). */
  ariaLabel?: string;
  className?: string;
}

export function RatingDisplay({
  valor,
  cantidadResenas,
  compact = false,
  ariaLabel,
  className,
}: RatingDisplayProps) {
  const rounded = Math.round(valor);

  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      aria-label={ariaLabel ?? ratingAccesible(valor, cantidadResenas)}
    >
      <span className="flex items-center" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn(
              "size-4",
              i <= rounded
                ? "fill-warning text-warning"
                : "fill-transparent text-border-strong",
            )}
          />
        ))}
      </span>
      <span className="text-sm font-medium text-foreground" aria-hidden="true">
        {formatRating(valor)}
      </span>
      {!compact && (
        <span className="text-sm text-muted-foreground" aria-hidden="true">
          ({cantidadResenas}{" "}
          {cantidadResenas === 1 ? "reseña" : "reseñas"})
        </span>
      )}
      <span className="sr-only">{copy.catalogo.estrellasAria}</span>
    </span>
  );
}
