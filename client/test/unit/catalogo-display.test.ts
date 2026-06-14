import { describe, it, expect } from "vitest";
import { mapDisponibilidad } from "@/lib/catalogo/disponibilidad";
import { formatRating, ratingAccesible } from "@/lib/catalogo/rating";

describe("mapDisponibilidad", () => {
  it("disponible_esta_semana → accent-subtle (Q1)", () => {
    const info = mapDisponibilidad("disponible_esta_semana");
    expect(info?.token).toBe("accent-subtle");
    expect(info?.icono).toBe("check");
    expect(info?.label).toBeTruthy();
  });

  it("proxima_disponible → warning-subtle (Q2)", () => {
    const info = mapDisponibilidad("proxima_disponible");
    expect(info?.token).toBe("warning-subtle");
    expect(info?.icono).toBe("clock");
  });

  it("sin_disponibilidad → surface-sunken (Q3)", () => {
    const info = mapDisponibilidad("sin_disponibilidad");
    expect(info?.token).toBe("surface-sunken");
    expect(info?.icono).toBe("dash");
  });

  it("null → null, the badge is omitted (Q4)", () => {
    expect(mapDisponibilidad(null)).toBeNull();
  });
});

describe("formatRating", () => {
  it("uses the es-AR decimal comma (Q5)", () => {
    expect(formatRating(4.5)).toBe("4,5");
  });

  it("always shows one decimal", () => {
    expect(formatRating(5)).toBe("5,0");
    expect(formatRating(3)).toBe("3,0");
  });

  it("rounds to one decimal", () => {
    expect(formatRating(4.46)).toBe("4,5");
    expect(formatRating(4.44)).toBe("4,4");
  });
});

describe("ratingAccesible", () => {
  it("returns the full text template (Q6)", () => {
    expect(ratingAccesible(4.5, 12)).toBe("4,5 de 5, 12 reseñas");
  });

  it("interpolates zero reviews", () => {
    expect(ratingAccesible(0, 0)).toBe("0,0 de 5, 0 reseñas");
  });
});
