import { describe, it, expect } from "vitest";
import {
  filtrarUbicaciones,
  UBICACIONES,
} from "@/lib/catalogo/ubicaciones";

describe("filtrarUbicaciones", () => {
  it("matches accent-insensitively ('obera' finds 'Oberá')", () => {
    const r = filtrarUbicaciones("obera");
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((u) => u.ciudad === "Oberá")).toBe(true);
    // The city-level entry is geocodable as a full Misiones string.
    expect(r.some((u) => u.value === "Oberá, Misiones, Argentina")).toBe(true);
  });

  it("matches a substring on the barrio ('cabello' finds Villa Cabello)", () => {
    const r = filtrarUbicaciones("cabello");
    expect(r).toHaveLength(1);
    expect(r[0].barrio).toBe("Villa Cabello");
    expect(r[0].value).toBe("Villa Cabello, Posadas, Misiones, Argentina");
  });

  it("returns the whole city group when the city name matches", () => {
    const r = filtrarUbicaciones("posadas");
    // City-level entry + its barrios, all under Posadas.
    expect(r.every((u) => u.ciudad === "Posadas")).toBe(true);
    expect(r.some((u) => u.barrio === null)).toBe(true); // "todo Posadas"
    expect(r.some((u) => u.barrio === "Villa Cabello")).toBe(true);
  });

  it("matches a city with no barrios (Puerto Iguazú) via partial query", () => {
    const r = filtrarUbicaciones("iguazu");
    expect(r).toHaveLength(1);
    expect(r[0].value).toBe("Puerto Iguazú, Misiones, Argentina");
  });

  it("returns the full list for an empty query", () => {
    expect(filtrarUbicaciones("")).toHaveLength(UBICACIONES.length);
  });

  it("returns the full list for a whitespace-only query", () => {
    expect(filtrarUbicaciones("   ")).toHaveLength(UBICACIONES.length);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filtrarUbicaciones("zzzznope")).toEqual([]);
  });

  it("is case-insensitive", () => {
    expect(filtrarUbicaciones("ELDORADO").every((u) => u.ciudad === "Eldorado")).toBe(
      true,
    );
    expect(filtrarUbicaciones("ELDORADO").length).toBeGreaterThan(0);
  });

  it("includes the four demo-seed cities at city level", () => {
    const ciudades = ["Posadas", "Oberá", "Eldorado", "Garupá"];
    for (const c of ciudades) {
      const todo = UBICACIONES.find((u) => u.ciudad === c && u.barrio === null);
      expect(todo, `missing city-level entry for ${c}`).toBeDefined();
      expect(todo?.value).toBe(`${c}, Misiones, Argentina`);
    }
  });

  it("every barrio value is a full geocodable '<Barrio>, <Ciudad>, Misiones, Argentina'", () => {
    for (const u of UBICACIONES) {
      if (u.barrio) {
        expect(u.value).toBe(`${u.barrio}, ${u.ciudad}, Misiones, Argentina`);
      } else {
        expect(u.value).toBe(`${u.ciudad}, Misiones, Argentina`);
      }
    }
  });
});
