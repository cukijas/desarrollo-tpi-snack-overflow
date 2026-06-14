"use client";

/**
 * Search bar (client, ADR-04-01/03, REQ-01, ESC-UI-02) — the heart of the
 * filter. RHF + zod (mode:'onBlur'), hydrated from the URL via props. On submit:
 * zod OK → build CriteriosBusqueda (page=1) → criteriosToQueryString →
 * startTransition(router.push). zod fails → block (NO router.push, NO HTTP),
 * inline error (aria-invalid + aria-describedby), focus the first missing field.
 *
 * `oficio` is FREE TEXT (the backend has no enum) — an <input> + <datalist> of
 * non-restrictive suggestions, NOT a Select. The only client rule is non-empty.
 */
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";

import { copy } from "@/lib/copy/es-AR";
import { OFICIOS_SUGERIDOS } from "@/lib/catalogo/oficios";
import {
  busquedaSchema,
  busquedaDefaults,
  type BusquedaFormValues,
} from "@/lib/validation/busqueda";
import {
  criteriosToQueryString,
} from "@/lib/catalogo/query-params";
import type { CriteriosBusqueda } from "@/lib/catalogo/tipos";

interface BarraBusquedaProps {
  /** Hydrated from the resolved searchParams (URL = source of truth). */
  defaults: Partial<BusquedaFormValues>;
  /** Current filters/order/pagination to preserve across a new search. */
  filtros: Partial<CriteriosBusqueda>;
}

const OFICIOS_DATALIST_ID = "oficios-sugeridos";

export function BarraBusqueda({ defaults, filtros }: BarraBusquedaProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BusquedaFormValues>({
    resolver: zodResolver(busquedaSchema),
    mode: "onBlur",
    defaultValues: {
      oficio: defaults.oficio ?? busquedaDefaults.oficio,
      ubicacion: defaults.ubicacion ?? busquedaDefaults.ubicacion,
    },
  });

  function onSubmit(values: BusquedaFormValues) {
    // zod already passed → build criteria preserving current filters, page=1.
    const criterios: CriteriosBusqueda = {
      oficio: values.oficio.trim(),
      ubicacion: values.ubicacion.trim(),
      orden: filtros.orden,
      calificacionMin: filtros.calificacionMin,
      fecha: filtros.fecha,
      pageSize: filtros.pageSize,
      page: 1,
    };
    const qs = criteriosToQueryString(criterios);
    startTransition(() => router.push(`/prestadores?${qs}`));
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-busy={isPending}
      className="flex flex-col gap-4 sm:flex-row sm:items-start"
    >
      <Field
        id="oficio"
        label={copy.catalogo.oficioLabel}
        required
        help={copy.catalogo.oficioHelp}
        error={errors.oficio?.message}
        className="flex-1"
      >
        {({ id, describedBy, invalid }) => (
          <>
            <Input
              id={id}
              type="text"
              list={OFICIOS_DATALIST_ID}
              placeholder={copy.catalogo.oficioPlaceholder}
              autoComplete="off"
              aria-required="true"
              aria-invalid={invalid}
              aria-describedby={describedBy}
              disabled={isPending}
              {...register("oficio")}
            />
            <datalist id={OFICIOS_DATALIST_ID}>
              {OFICIOS_SUGERIDOS.map((o) => (
                <option key={o.value} value={o.label} />
              ))}
            </datalist>
          </>
        )}
      </Field>

      <Field
        id="ubicacion"
        label={copy.catalogo.ubicacionLabel}
        required
        help={copy.catalogo.ubicacionHelp}
        error={errors.ubicacion?.message}
        className="flex-1"
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            type="text"
            placeholder={copy.catalogo.ubicacionPlaceholder}
            autoComplete="off"
            aria-required="true"
            aria-invalid={invalid}
            aria-describedby={describedBy}
            disabled={isPending}
            {...register("ubicacion")}
          />
        )}
      </Field>

      <Button
        type="submit"
        size="lg"
        loading={isPending}
        disabled={isPending}
        className="sm:mt-7"
      >
        <Search aria-hidden="true" />
        {isPending ? copy.catalogo.buscando : copy.catalogo.buscar}
      </Button>
    </form>
  );
}
