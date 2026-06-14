import { describe, it, expect } from "vitest";
import { busquedaSchema } from "@/lib/validation/busqueda";
import { copy } from "@/lib/copy/es-AR";

describe("busquedaSchema", () => {
  it("blocks an empty oficio (ESC-UI-02)", () => {
    const result = busquedaSchema.safeParse({ oficio: "", ubicacion: "Posadas" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "oficio");
      expect(issue?.message).toBe(copy.catalogo.errors.oficioRequerido);
    }
  });

  it("blocks a whitespace-only oficio", () => {
    const result = busquedaSchema.safeParse({ oficio: "   ", ubicacion: "Posadas" });
    expect(result.success).toBe(false);
  });

  it("blocks an empty ubicacion (ESC-UI-02)", () => {
    const result = busquedaSchema.safeParse({ oficio: "electricista", ubicacion: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "ubicacion");
      expect(issue?.message).toBe(copy.catalogo.errors.ubicacionRequerida);
    }
  });

  it("passes when both are present", () => {
    const result = busquedaSchema.safeParse({
      oficio: "electricista",
      ubicacion: "Posadas",
    });
    expect(result.success).toBe(true);
  });

  it("accepts ANY free-text oficio (NOT an enum — oficio is free text)", () => {
    const result = busquedaSchema.safeParse({
      oficio: "domador de caballos",
      ubicacion: "Posadas",
    });
    expect(result.success).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    const result = busquedaSchema.safeParse({
      oficio: "  plomero  ",
      ubicacion: "  Oberá  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.oficio).toBe("plomero");
      expect(result.data.ubicacion).toBe("Oberá");
    }
  });
});
