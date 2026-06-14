/**
 * Pure rating formatters (ADR-04-05, REQ-03/REQ-11, OCL §8 Q5-Q6).
 *
 * `formatRating` uses es-AR decimal comma (4.5 → "4,5"); `ratingAccesible`
 * produces the screen-reader text that is ALWAYS present alongside the
 * decorative stars, so meaning never depends on counting stars.
 */
import { copy } from "@/lib/copy/es-AR";

/**
 * Formats a rating with one decimal and the es-AR decimal comma.
 * `formatRating(4.5) === "4,5"`, `formatRating(5) === "5,0"`.
 */
export function formatRating(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n);
}

/**
 * Accessible rating text: "{formatRating(n)} de 5, {N} reseñas".
 * Built from copy so the template stays centralized (REQ-11).
 */
export function ratingAccesible(n: number, N: number): string {
  return copy.catalogo.calificacionAccesible
    .replace("{valor}", formatRating(n))
    .replace("{N}", String(N));
}
