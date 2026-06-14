/**
 * Trade (oficio) SUGGESTIONS for the search combobox (RF-2.1).
 *
 * IMPORTANT (grounding, supersedes the "enum of 7 categories" wording in the
 * spec/design): in the backend `oficio`/`oficios` is FREE TEXT (a `simple-array`
 * of arbitrary strings, no enum validation; `categoria` is a free varchar). The
 * `regulated_trades` table is only used by registration (UC01/UC18) to flag
 * regulated trades — it does NOT constrain catalog SEARCH. Therefore the search
 * `oficio` input is free text: the backend accepts any string.
 *
 * These values are SUGGESTIONS only (datalist/non-restrictive combobox). They
 * reuse the UC01 `TRADES` catalog so the labels stay consistent, but the search
 * is NOT limited to them — a user can type any oficio. The only client-side
 * validation is "non-empty" (see lib/validation/busqueda.ts), to avoid the
 * backend 400 for a missing `oficio`.
 *
 * Supuesto S2 (resolved): single source = UC01 `TRADES`. No invented values.
 */
import { TRADES } from "@/lib/trades";

export interface OficioSugerencia {
  /** The free-text value submitted to the backend (mirrors UC01 seed value). */
  value: string;
  /** Human label shown in the suggestion list (es-AR). */
  label: string;
}

/**
 * Non-restrictive suggestion list for the oficio combobox/datalist.
 * Derived from UC01 `TRADES`; the search value is NOT limited to these.
 */
export const OFICIOS_SUGERIDOS: readonly OficioSugerencia[] = TRADES.map(
  (t) => ({ value: t.value, label: t.label }),
);
