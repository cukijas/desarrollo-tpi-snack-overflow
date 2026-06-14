import { describe, it, expect } from "vitest";

import {
  insigniasDe,
  UMBRALES,
  MAX_INSIGNIAS,
} from "@/lib/catalogo/insignias";

const claves = (
  p: { calificacionPromedio: number; cantidadResenas: number },
): string[] => insigniasDe(p).map((i) => i.clave);

describe("insigniasDe — Súper prestador (premium trust, §5.6)", () => {
  it("earns Súper at the boundary (4,8 y 50 reseñas)", () => {
    const ins = insigniasDe({
      calificacionPromedio: UMBRALES.superCalificacion,
      cantidadResenas: UMBRALES.superResenas,
    });
    expect(ins.map((i) => i.clave)).toContain("super");
    const sup = ins.find((i) => i.clave === "super")!;
    expect(sup.token).toBe("accent-subtle");
    expect(sup.icono).toBe("award");
    expect(sup.label).toBeTruthy();
  });

  it("does NOT earn Súper just below the rating (4,79 con 50 reseñas)", () => {
    expect(
      claves({ calificacionPromedio: 4.79, cantidadResenas: 50 }),
    ).not.toContain("super");
  });

  it("does NOT earn Súper just below the review count (4,9 con 49 reseñas)", () => {
    expect(
      claves({ calificacionPromedio: 4.9, cantidadResenas: 49 }),
    ).not.toContain("super");
  });
});

describe("insigniasDe — Muy elegido (popularity, §5.6)", () => {
  it("earns Muy elegido at 100 reseñas", () => {
    const ins = insigniasDe({ calificacionPromedio: 4.0, cantidadResenas: 100 });
    const eleg = ins.find((i) => i.clave === "elegido");
    expect(eleg).toBeDefined();
    expect(eleg!.token).toBe("info-subtle");
    expect(eleg!.icono).toBe("trending-up");
  });

  it("does NOT earn Muy elegido at 99 reseñas", () => {
    expect(
      claves({ calificacionPromedio: 4.0, cantidadResenas: 99 }),
    ).not.toContain("elegido");
  });

  it("stacks Súper + Muy elegido for a top, popular provider", () => {
    const c = claves({ calificacionPromedio: 4.9, cantidadResenas: 120 });
    expect(c).toEqual(["super", "elegido"]);
  });
});

describe("insigniasDe — Nuevo (friendly onboarding, §5.6)", () => {
  it("0 reseñas → Nuevo, surface-sunken, no premium badge", () => {
    const ins = insigniasDe({ calificacionPromedio: 0, cantidadResenas: 0 });
    expect(ins).toHaveLength(1);
    expect(ins[0].clave).toBe("nuevo");
    expect(ins[0].token).toBe("surface-sunken");
    expect(ins[0].icono).toBe("sparkles");
  });

  it("just under the threshold (2 reseñas) is still Nuevo", () => {
    expect(
      claves({ calificacionPromedio: 5, cantidadResenas: 2 }),
    ).toEqual(["nuevo"]);
  });

  it("at the threshold (3 reseñas) is no longer Nuevo", () => {
    expect(
      claves({ calificacionPromedio: 5, cantidadResenas: 3 }),
    ).not.toContain("nuevo");
  });

  it("a high rating with few reviews does NOT fabricate a trust badge", () => {
    // 5,0 but only 1 review → not enough signal → Nuevo, not Súper.
    expect(claves({ calificacionPromedio: 5, cantidadResenas: 1 })).toEqual([
      "nuevo",
    ]);
  });
});

describe("insigniasDe — plain provider & capping", () => {
  it("a solid mid provider earns NO premium badge (clean card)", () => {
    // 4,5 con 30 reseñas: above Nuevo, below every premium tier.
    expect(claves({ calificacionPromedio: 4.5, cantidadResenas: 30 })).toEqual(
      [],
    );
  });

  it("never renders more than MAX_INSIGNIAS", () => {
    const ins = insigniasDe({ calificacionPromedio: 5, cantidadResenas: 500 });
    expect(ins.length).toBeLessThanOrEqual(MAX_INSIGNIAS);
  });
});
