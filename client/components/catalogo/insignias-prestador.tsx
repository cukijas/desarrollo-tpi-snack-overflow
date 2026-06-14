import { Award, Sparkles, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  insigniasDe,
  type Insignia,
  type InsigniaIcono,
} from "@/lib/catalogo/insignias";
import type { PrestadorResumen } from "@/lib/catalogo/tipos";

/**
 * Trust/engagement badges row (Server Component, DESIGN-SYSTEM §5.6, WCAG
 * 1.4.1). Pure render over `insigniasDe` — the earned badges are the card's
 * primary trust signal (§5.3). Each badge is text + icon (never color-only) and
 * uses an existing §5.6 family token. Renders nothing when no badge is earned.
 */
const ICONS: Record<InsigniaIcono, typeof Award> = {
  award: Award,
  "trending-up": TrendingUp,
  sparkles: Sparkles,
};

/** §5.6 token → Tailwind classes (tokens only, no ad-hoc color). */
const TOKEN_CLASSES: Record<Insignia["token"], string> = {
  "accent-subtle": "bg-accent-subtle text-success-deep",
  "info-subtle": "bg-info-subtle text-info",
  "surface-sunken": "bg-surface-sunken text-muted-foreground",
};

interface InsigniasPrestadorProps {
  prestador: Pick<PrestadorResumen, "calificacionPromedio" | "cantidadResenas">;
  className?: string;
}

export function InsigniasPrestador({
  prestador,
  className,
}: InsigniasPrestadorProps) {
  const insignias = insigniasDe(prestador);
  if (insignias.length === 0) return null;

  return (
    <ul className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {insignias.map((insignia) => {
        const Icon = ICONS[insignia.icono];
        return (
          <li
            key={insignia.clave}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
              TOKEN_CLASSES[insignia.token],
            )}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden="true" />
            {insignia.label}
          </li>
        );
      })}
    </ul>
  );
}
