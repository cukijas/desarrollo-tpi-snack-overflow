/**
 * Hardcoded LOCATION tree for the search combobox (UC04, REQ-01) — a cheap PoC,
 * NO geocoding API and NO npm deps. Representative set of Misiones (Argentina)
 * cities + barrios, not exhaustive (~30–45 entries).
 *
 * WHY this shape (critical): the backend geocodes the submitted `ubicacion`
 * STRING via Nominatim with NO country/region restriction
 * (server/src/catalogo/adapters/openstreetmap-geocoding.adapter.ts), then does
 * point-in-polygon against each prestador's `zona_cobertura`. So the value the
 * form submits MUST be an unambiguous, Nominatim-geocodable string:
 *   - a barrio submits "<Barrio>, <Ciudad>, Misiones, Argentina"
 *   - a city submits "<Ciudad>, Misiones, Argentina"
 * The combobox only shows a short label; the submitted `value` carries the full
 * geocodable string. No backend change — it still receives one `ubicacion`.
 *
 * The cities Posadas, Oberá, Eldorado and Garupá MUST exist here: the demo seed
 * uses them, so they have to resolve.
 */

/** Province + country suffix shared by every geocodable value. */
const PROVINCIA = "Misiones, Argentina";

export interface Ubicacion {
  /** Stable key for React lists and selection identity. */
  id: string;
  /** Short, readable label for the combobox (e.g. "Posadas — Villa Cabello"). */
  label: string;
  /**
   * Full, Nominatim-geocodable string submitted to the backend `ubicacion`
   * field (e.g. "Villa Cabello, Posadas, Misiones, Argentina").
   */
  value: string;
  /** City this entry belongs to — used for grouping and city-text matching. */
  ciudad: string;
  /** Barrio name, or null for the city-level ("todo <Ciudad>") entry. */
  barrio: string | null;
}

/** Builds the city-level "todo <Ciudad>" entry. */
function ciudadEntry(ciudad: string): Ubicacion {
  return {
    id: slug(ciudad),
    label: ciudad,
    value: `${ciudad}, ${PROVINCIA}`,
    ciudad,
    barrio: null,
  };
}

/** Builds a barrio entry under a city. */
function barrioEntry(ciudad: string, barrio: string): Ubicacion {
  return {
    id: `${slug(ciudad)}--${slug(barrio)}`,
    label: `${ciudad} — ${barrio}`,
    value: `${barrio}, ${ciudad}, ${PROVINCIA}`,
    ciudad,
    barrio,
  };
}

/** ASCII slug for stable ids (accent-stripped, non-alphanumerics collapsed). */
function slug(text: string): string {
  return quitarAcentos(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Builds a city group: its "todo <Ciudad>" entry first, then its barrios.
 * Co-locating barrios with their city keeps the tree readable and lets the
 * filter return the whole city group when the city name matches.
 */
function grupoCiudad(ciudad: string, barrios: readonly string[] = []): Ubicacion[] {
  return [ciudadEntry(ciudad), ...barrios.map((b) => barrioEntry(ciudad, b))];
}

/**
 * The hardcoded tree, flattened to a list (each city group = city entry +
 * barrios). City-level entries for the seed cities (Posadas, Oberá, Eldorado,
 * Garupá) plus a representative set of other Misiones cities.
 */
export const UBICACIONES: readonly Ubicacion[] = [
  ...grupoCiudad("Posadas", [
    "Centro",
    "Villa Cabello",
    "Itaembé Guazú",
    "Itaembé Miní",
    "Villa Sarita",
    "Miguel Lanús",
    "Bajada Vieja",
    "San Isidro",
  ]),
  ...grupoCiudad("Oberá", ["Centro", "Villa Svea", "Barrio Belgrano"]),
  ...grupoCiudad("Eldorado", ["Centro", "Km 9", "Pueblo Nuevo"]),
  ...grupoCiudad("Garupá", ["Centro", "San Marcos"]),
  ...grupoCiudad("Puerto Iguazú"),
  ...grupoCiudad("Apóstoles"),
  ...grupoCiudad("Leandro N. Alem"),
  ...grupoCiudad("Montecarlo"),
  ...grupoCiudad("Puerto Rico"),
  ...grupoCiudad("Jardín América"),
  ...grupoCiudad("San Vicente"),
  ...grupoCiudad("Aristóbulo del Valle"),
  ...grupoCiudad("Wanda"),
  ...grupoCiudad("Candelaria"),
];

/** Removes diacritics so "obera" matches "Oberá" (accent-insensitive search). */
function quitarAcentos(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Normalizes for comparison: trimmed, lowercased, accent-stripped. */
function normalizar(text: string): string {
  return quitarAcentos(text.trim().toLowerCase());
}

/**
 * PURE filtering helper (the unit-tested heart). Accent- and case-insensitive
 * substring match over BOTH the city and barrio text. An empty/whitespace query
 * returns the full list. No match returns an empty array.
 */
export function filtrarUbicaciones(query: string): Ubicacion[] {
  const q = normalizar(query);
  if (q === "") return [...UBICACIONES];

  return UBICACIONES.filter((u) => {
    const enCiudad = normalizar(u.ciudad).includes(q);
    const enBarrio = u.barrio ? normalizar(u.barrio).includes(q) : false;
    return enCiudad || enBarrio;
  });
}
