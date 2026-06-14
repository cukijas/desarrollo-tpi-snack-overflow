/**
 * Pure avatar helpers — initials + a deterministic brand tint for the fallback
 * avatar (DESIGN-SYSTEM §5.11). No real photos exist yet, so the card renders an
 * initials fallback on a color "derivado determinísticamente del nombre (paleta
 * de tierras/verdes, nunca colores semánticos)".
 *
 * The color is picked from a FIXED palette of brand tint pairs (background +
 * foreground), each expressed with EXISTING design tokens — never raw hex
 * (DESIGN-SYSTEM "regla de oro" §10). Every pair is a dark-on-light combo whose
 * contrast clears AA (the `*-subtle` tints are very light; the paired text is a
 * deep brand/earth token). Semantic tokens (success/warning/error/info) are
 * deliberately excluded so the avatar never looks like a status signal.
 */

/**
 * A deterministic tint = the Tailwind utility classes for its background and
 * text. Both reference design tokens (no ad-hoc color).
 */
export interface AvatarTinte {
  /** Stable key (useful for tests / debugging). */
  clave: string;
  /** Tailwind classes: token-based background + foreground. */
  clases: string;
}

/**
 * Earth/green brand palette (§5.11). Tierra colorada + verde monte tints, each
 * with a deep, AA-contrasting text token. NO semantic colors.
 */
export const TINTES_AVATAR: readonly AvatarTinte[] = [
  // Verde monte (secondary): deep green text on the secondary-subtle tint.
  { clave: "monte", clases: "bg-secondary-subtle text-secondary" },
  // Verde confianza (accent): the accent tint with deep success text.
  { clave: "selva", clases: "bg-accent-subtle text-success-deep" },
  // Tierra colorada (primary): the primary tint with the hover (darker) tierra.
  { clave: "tierra", clases: "bg-primary-subtle text-primary-hover" },
  // Neutro cálido (surface): sunken stone tint with strong foreground.
  { clave: "arena", clases: "bg-surface-sunken text-foreground" },
] as const;

/**
 * Derives up to two uppercase initials from a full name: first letter of the
 * first token + first letter of the LAST token (so "Ana María Pérez" → "AP").
 * Falls back to a single initial for a one-word name, and "?" when empty.
 * Unicode-aware (handles accented names) and locale-uppercased for es-AR.
 */
export function inicialesDe(nombreCompleto: string): string {
  const tokens = nombreCompleto.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "?";

  const primera = [...tokens[0]][0] ?? "";
  const ultima =
    tokens.length > 1 ? ([...tokens[tokens.length - 1]][0] ?? "") : "";

  return (primera + ultima).toLocaleUpperCase("es-AR");
}

/**
 * Picks a tint deterministically from the name, so the same provider always
 * renders the same color across pages. Uses a small stable string hash over the
 * code points (order-independent of platform) modulo the palette length.
 */
export function tinteDe(nombreCompleto: string): AvatarTinte {
  let hash = 0;
  for (const ch of nombreCompleto.trim()) {
    // (hash * 31 + code) with 32-bit wrap — classic, stable, no deps.
    hash = (Math.imul(hash, 31) + ch.codePointAt(0)!) | 0;
  }
  const indice = Math.abs(hash) % TINTES_AVATAR.length;
  return TINTES_AVATAR[indice];
}
