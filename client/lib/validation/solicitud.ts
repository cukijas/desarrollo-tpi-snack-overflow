/**
 * Client-side validation for the hiring request form (ADR-07-05, REQ-03,
 * ESC-UI-03). Mirrors login.ts / busqueda.ts: zod schema as the single source
 * of truth, reusable in tests.
 *
 * `ubicacion` / `franja` / `descripcion` are required non-empty (prevents the
 * backend 400). `fecha` is an ISO date (YYYY-MM-DD from <input type="date">)
 * that must be today or a future LOCAL date (prevents the backend 422).
 *
 * S1: `franja` is FREE TEXT (the backend DTO accepts any non-empty string and
 * validates availability server-side). The form constrains it to a curated
 * es-AR set via <Select> (copy.solicitud.franjas), but the schema only enforces
 * "non-empty" — it does NOT hardcode an enum the backend never declared.
 */
import { z } from "zod";
import { copy } from "@/lib/copy/es-AR";

/**
 * Today's LOCAL date as an ISO `YYYY-MM-DD` string. Pure given a reference
 * `Date`, so `esFechaValida`/`hoyISO` are testable without touching `Date.now`.
 */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** ISO calendar date `YYYY-MM-DD` for "today" derived from a reference Date. */
export function hoyISO(now: Date = new Date()): string {
  return toISODate(now);
}

/**
 * Pure date comparison (no `Date.now()` inside): a request date is valid when
 * it is a well-formed `YYYY-MM-DD` and is today or later than `hoy` (also
 * `YYYY-MM-DD`). Lexicographic comparison is correct for zero-padded ISO dates.
 *
 * @param iso the candidate date (`YYYY-MM-DD`)
 * @param hoy today's date (`YYYY-MM-DD`); injected so tests are deterministic
 */
export function esFechaValida(iso: string, hoy: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  return iso >= hoy;
}

export const solicitudSchema = z.object({
  ubicacion: z
    .string()
    .trim()
    .min(1, copy.solicitud.errors.ubicacionRequerida),
  // ISO date from <input type="date">. Required first, then "today or future".
  fecha: z
    .string()
    .trim()
    .min(1, copy.solicitud.errors.fechaRequerida)
    .refine((value) => esFechaValida(value, hoyISO()), {
      message: copy.solicitud.errors.fechaPasada,
    }),
  // Free text, non-empty only — the curated set lives in copy, NOT here.
  franja: z.string().trim().min(1, copy.solicitud.errors.franjaRequerida),
  descripcion: z
    .string()
    .trim()
    .min(1, copy.solicitud.errors.descripcionRequerida),
});

export type SolicitudFormValues = z.infer<typeof solicitudSchema>;

export const solicitudDefaults: SolicitudFormValues = {
  ubicacion: "",
  fecha: "",
  franja: "",
  descripcion: "",
};
