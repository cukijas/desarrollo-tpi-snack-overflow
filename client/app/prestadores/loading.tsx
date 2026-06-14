import { ResultadosSkeleton } from "@/components/catalogo/resultados-skeleton";

/**
 * Streaming UI for the listing route (Next, REQ-05, ADR-04-01). Shown while the
 * Server Component re-fetches after a navigation (router.push of a new query).
 * Reuses <ResultadosSkeleton/> (aria-busy) so there is no full-page spinner.
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <ResultadosSkeleton />
    </div>
  );
}
