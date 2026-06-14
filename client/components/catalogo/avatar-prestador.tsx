import { cn } from "@/lib/utils";
import { copy } from "@/lib/copy/es-AR";
import { inicialesDe, tinteDe } from "@/lib/catalogo/avatar";

/**
 * Provider avatar with an initials fallback (Server Component, DESIGN-SYSTEM
 * §5.11, §8). No real photos exist yet, so we render the initials on a brand
 * tint derived DETERMINISTICALLY from the name (earth/green palette, never
 * semantic colors — see lib/catalogo/avatar.ts). Token classes only, no hex.
 *
 * A11y: the initials are a DECORATIVE rendering of the name. When the avatar
 * sits next to the visible name (the card), pass `decorativo` so the circle is
 * `aria-hidden` and the screen reader reads the real name once. Standalone
 * (e.g. a future profile header) it exposes an accessible label via `role/img`.
 */
const TAMANOS = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-xl",
} as const;

interface AvatarPrestadorProps {
  nombreCompleto: string;
  /** Visual size (§5.11): sm(32) · md(40, card) · lg(64, profile). */
  tamano?: keyof typeof TAMANOS;
  /** When the name is already visible beside it, hide the avatar from a11y. */
  decorativo?: boolean;
  className?: string;
}

export function AvatarPrestador({
  nombreCompleto,
  tamano = "md",
  decorativo = false,
  className,
}: AvatarPrestadorProps) {
  const iniciales = inicialesDe(nombreCompleto);
  const tinte = tinteDe(nombreCompleto);

  const a11y = decorativo
    ? ({ "aria-hidden": true } as const)
    : ({
        role: "img" as const,
        "aria-label": copy.catalogo.avatarAlt.replace("{nombre}", nombreCompleto),
      } as const);

  return (
    <span
      {...a11y}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold leading-none select-none",
        TAMANOS[tamano],
        tinte.clases,
        className,
      )}
    >
      {iniciales}
    </span>
  );
}
