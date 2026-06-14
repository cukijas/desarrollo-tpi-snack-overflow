/**
 * Pure trust/engagement badges (DESIGN-SYSTEM §5.6, WCAG 1.4.1).
 *
 * Every badge is an HONEST derivation of fields that already exist on
 * `PrestadorResumen` — there is NO "jobs completed", "response time" or
 * "verified" field in the contract, so we never fabricate one. Badges are the
 * card's primary trust signal (the marketplace/Uber "Top Rated" analogue,
 * §5.3), so we cap how many render to keep the card clean.
 *
 * Each badge carries TEXT + an icon and maps to a §5.6 badge family token —
 * color is reinforcement only, never the sole channel (WCAG 1.4.1). Labels live
 * in copy (es-AR); this module stays pure and locale-agnostic in its logic.
 */
import { copy } from "@/lib/copy/es-AR";
import type { PrestadorResumen } from "@/lib/catalogo/tipos";

/** Lucide icon names used by the badges (resolved to components in the UI). */
export type InsigniaIcono = "award" | "trending-up" | "sparkles";

/**
 * A §5.6 token family. We reuse the existing badge tints:
 * - `accent-subtle`  → green "confianza" (premium trust),
 * - `info-subtle`    → neutral/informational (popular),
 * - `surface-sunken` → friendly neutral (new, NOT negative).
 */
export type InsigniaToken = "accent-subtle" | "info-subtle" | "surface-sunken";

export interface Insignia {
  /** Stable identity (also the React key / test anchor). */
  clave: "super" | "elegido" | "nuevo";
  /** es-AR label (from copy). */
  label: string;
  /** Icon + text so meaning is not color-only (WCAG 1.4.1). */
  icono: InsigniaIcono;
  /** §5.6 badge family token. */
  token: InsigniaToken;
}

/** Honest thresholds — tuned to be earned, not handed out. */
export const UMBRALES = {
  /** "Súper prestador": premium trust (Uber "Top Rated"). */
  superCalificacion: 4.8,
  superResenas: 50,
  /** "Muy elegido": high engagement (volume of reviews). */
  elegidoResenas: 100,
  /** "Nuevo": friendly onboarding tier, not yet enough signal to judge. */
  nuevoResenasMax: 3,
} as const;

/** Max badges rendered on a card so the trust row stays tasteful (§5.3). */
export const MAX_INSIGNIAS = 2;

type EntradaPrestador = Pick<
  PrestadorResumen,
  "calificacionPromedio" | "cantidadResenas"
>;

/**
 * Returns the badges a provider has EARNED, already capped at `MAX_INSIGNIAS`
 * and ordered by trust weight (premium first).
 *
 * Tiers (honest, derived only from rating + review count):
 * - **Súper prestador** — `calificacionPromedio >= 4.8 && cantidadResenas >= 50`.
 *   Premium green `accent-subtle` + `Award` (§5.6 "verificación/confianza").
 * - **Muy elegido** — `cantidadResenas >= 100`. Neutral `info-subtle` +
 *   `TrendingUp`. Stacks under Súper (a top provider can also be popular).
 * - **Nuevo** — `cantidadResenas < 3`. Friendly `surface-sunken` + `Sparkles`,
 *   never a negative/penalty color. Mutually exclusive with the others.
 */
export function insigniasDe(p: EntradaPrestador): Insignia[] {
  const { calificacionPromedio, cantidadResenas } = p;
  const insignias: Insignia[] = [];

  if (cantidadResenas < UMBRALES.nuevoResenasMax) {
    // Too little signal to earn a trust badge — show the friendly "Nuevo" tier.
    insignias.push({
      clave: "nuevo",
      label: copy.catalogo.insignias.nuevo,
      icono: "sparkles",
      token: "surface-sunken",
    });
    return insignias.slice(0, MAX_INSIGNIAS);
  }

  if (
    calificacionPromedio >= UMBRALES.superCalificacion &&
    cantidadResenas >= UMBRALES.superResenas
  ) {
    insignias.push({
      clave: "super",
      label: copy.catalogo.insignias.super,
      icono: "award",
      token: "accent-subtle",
    });
  }

  if (cantidadResenas >= UMBRALES.elegidoResenas) {
    insignias.push({
      clave: "elegido",
      label: copy.catalogo.insignias.elegido,
      icono: "trending-up",
      token: "info-subtle",
    });
  }

  return insignias.slice(0, MAX_INSIGNIAS);
}
