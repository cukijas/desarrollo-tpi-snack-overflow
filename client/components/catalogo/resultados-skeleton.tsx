/**
 * Loading skeleton for the results grid (Server Component, REQ-05). The
 * container sets `aria-busy="true"` so assistive tech announces the busy state.
 * Reused by app/prestadores/loading.tsx (streaming UI) and the Suspense
 * fallback in the listing page.
 */
export function ResultadosSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
        >
          <div className="h-5 w-2/3 animate-pulse rounded bg-surface-sunken" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-surface-sunken" />
          <div className="flex gap-1.5">
            <div className="h-5 w-16 animate-pulse rounded-full bg-surface-sunken" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-surface-sunken" />
          </div>
          <div className="h-5 w-28 animate-pulse rounded-full bg-surface-sunken" />
        </div>
      ))}
    </div>
  );
}
