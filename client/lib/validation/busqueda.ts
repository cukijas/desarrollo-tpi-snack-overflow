/**
 * Client-side validation for the search bar (ADR-04-03, REQ-01, ESC-UI-02).
 *
 * DELIBERATELY non-restrictive on `oficio`: the backend treats `oficio` as
 * FREE TEXT (no enum). The only invariant the client enforces is "non-empty"
 * for both `oficio` and `ubicacion`, which prevents the backend 400
 * ("El oficio es obligatorio" / "La ubicación es obligatoria"). The suggestion
 * list (lib/catalogo/oficios.ts) is a convenience, not a constraint.
 *
 * Single source of truth for the form, reusable in tests (mirrors login.ts).
 */
import { z } from "zod";
import { copy } from "@/lib/copy/es-AR";

export const busquedaSchema = z.object({
  // Free text, non-empty only — NOT an enum (oficio is free text in the backend).
  oficio: z.string().trim().min(1, copy.catalogo.errors.oficioRequerido),
  ubicacion: z
    .string()
    .trim()
    .min(1, copy.catalogo.errors.ubicacionRequerida),
});

export type BusquedaFormValues = z.infer<typeof busquedaSchema>;

export const busquedaDefaults: BusquedaFormValues = {
  oficio: "",
  ubicacion: "",
};
