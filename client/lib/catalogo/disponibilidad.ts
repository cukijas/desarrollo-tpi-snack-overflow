/**
 * Pure mapping of the backend `disponibilidad` value to its accessible badge
 * descriptor (ADR-04-05, REQ-04, WCAG 1.4.1, OCL §8 Q1-Q4).
 *
 * The badge ALWAYS carries text + an icon/dot; color is reinforcement only,
 * never the sole channel. `null` → no badge is rendered.
 *
 * Labels live in copy (es-AR). `proxima_disponible` needs the date interpolated
 * at render time, so its label here is the bare prefix and the component
 * appends the formatted date — see DisponibilidadBadge.
 */
import { copy } from "@/lib/copy/es-AR";
import type { Disponibilidad } from "@/lib/catalogo/tipos";

export type DisponibilidadIcono = "check" | "clock" | "dash";

export interface DisponibilidadBadgeInfo {
  /** Base es-AR label (the date for `proxima_disponible` is appended by the UI). */
  label: string;
  /** Design-system token used as the reinforcement color. */
  token: "accent-subtle" | "warning-subtle" | "surface-sunken";
  /** Icon/dot shape so meaning is not color-only (WCAG 1.4.1). */
  icono: DisponibilidadIcono;
}

/**
 * Maps a `disponibilidad` value to its badge descriptor.
 * Returns `null` for `null` input (the badge is omitted entirely).
 */
export function mapDisponibilidad(
  v: Disponibilidad | null,
): DisponibilidadBadgeInfo | null {
  switch (v) {
    case "disponible_esta_semana":
      return {
        label: copy.catalogo.disponibilidad.disponibleEstaSemana,
        token: "accent-subtle",
        icono: "check",
      };
    case "proxima_disponible":
      return {
        label: copy.catalogo.disponibilidad.proximaPrefijo,
        token: "warning-subtle",
        icono: "clock",
      };
    case "sin_disponibilidad":
      return {
        label: copy.catalogo.disponibilidad.sinDisponibilidad,
        token: "surface-sunken",
        icono: "dash",
      };
    default:
      return null;
  }
}
