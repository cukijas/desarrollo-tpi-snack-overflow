import { Check, Clock, Minus } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Disponibilidad } from "@/lib/catalogo/tipos";
import {
  mapDisponibilidad,
  type DisponibilidadIcono,
} from "@/lib/catalogo/disponibilidad";

/**
 * Availability badge (Server Component, ADR-04-05, REQ-04, WCAG 1.4.1). Always
 * carries TEXT + an icon; color is reinforcement only. `null` → renders nothing.
 * For `proxima_disponible` the formatted date is appended to the label.
 */
interface DisponibilidadBadgeProps {
  disponibilidad: Disponibilidad | null;
  proximaFechaDisponible?: string;
  className?: string;
}

const ICONS: Record<DisponibilidadIcono, typeof Check> = {
  check: Check,
  clock: Clock,
  dash: Minus,
};

const TOKEN_CLASSES: Record<string, string> = {
  "accent-subtle": "bg-accent-subtle text-accent",
  "warning-subtle": "bg-warning-subtle text-warning-deep dark:text-warning",
  "surface-sunken": "bg-surface-sunken text-muted-foreground",
};

export function DisponibilidadBadge({
  disponibilidad,
  proximaFechaDisponible,
  className,
}: DisponibilidadBadgeProps) {
  const info = mapDisponibilidad(disponibilidad);
  if (!info) return null;

  const Icon = ICONS[info.icono];
  const label =
    disponibilidad === "proxima_disponible" && proximaFechaDisponible
      ? `${info.label}: ${proximaFechaDisponible}`
      : info.label;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        TOKEN_CLASSES[info.token],
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}
