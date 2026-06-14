import { describe, it, expect } from "vitest";
import {
  solicitudSchema,
  esFechaValida,
  toISODate,
} from "@/lib/validation/solicitud";

describe("esFechaValida (pure, injected `hoy`)", () => {
  const HOY = "2026-06-13";

  it("today is valid", () => {
    expect(esFechaValida("2026-06-13", HOY)).toBe(true);
  });

  it("a future date is valid", () => {
    expect(esFechaValida("2026-06-14", HOY)).toBe(true);
    expect(esFechaValida("2027-01-01", HOY)).toBe(true);
  });

  it("yesterday (a past date) fails", () => {
    expect(esFechaValida("2026-06-12", HOY)).toBe(false);
    expect(esFechaValida("2025-12-31", HOY)).toBe(false);
  });

  it("a malformed date fails", () => {
    expect(esFechaValida("13-06-2026", HOY)).toBe(false);
    expect(esFechaValida("", HOY)).toBe(false);
    expect(esFechaValida("2026/06/13", HOY)).toBe(false);
  });
});

describe("toISODate", () => {
  it("zero-pads month and day from a local Date", () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toISODate(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("solicitudSchema", () => {
  // A safely-future date so the schema's internal `hoyISO()` never rejects it.
  const FUTURO = toISODate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

  const VALID = {
    ubicacion: "Posadas, centro",
    fecha: FUTURO,
    franja: "Mañana (08–12)",
    descripcion: "Se quemó el tablero",
  };

  it("accepts a fully-populated valid request", () => {
    expect(solicitudSchema.safeParse(VALID).success).toBe(true);
  });

  it("blocks empty ubicacion", () => {
    const r = solicitudSchema.safeParse({ ...VALID, ubicacion: "   " });
    expect(r.success).toBe(false);
  });

  it("blocks empty franja", () => {
    const r = solicitudSchema.safeParse({ ...VALID, franja: "" });
    expect(r.success).toBe(false);
  });

  it("blocks empty descripcion", () => {
    const r = solicitudSchema.safeParse({ ...VALID, descripcion: "" });
    expect(r.success).toBe(false);
  });

  it("blocks a missing date", () => {
    const r = solicitudSchema.safeParse({ ...VALID, fecha: "" });
    expect(r.success).toBe(false);
  });

  it("blocks a past date", () => {
    const r = solicitudSchema.safeParse({ ...VALID, fecha: "2000-01-01" });
    expect(r.success).toBe(false);
  });
});
