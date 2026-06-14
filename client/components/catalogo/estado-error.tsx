"use client";

import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy/es-AR";

/**
 * Retryable error state (client, ADR-04-04, REQ-05, ESC-UI-07). Uses
 * `role="alert"` (announced + distinct from the empty state) and a "Reintentar"
 * button that calls `router.refresh()` to re-run the Server Component fetch.
 * Copy is non-technical; NO stack traces or backend details are exposed.
 */
export function EstadoError() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <Alert variant="error" role="alert" className="max-w-md">
        <p className="font-medium">{copy.catalogo.error.titulo}</p>
        <p className="text-sm">{copy.catalogo.error.cuerpo}</p>
      </Alert>
      <Button variant="outline" onClick={() => router.refresh()}>
        {copy.catalogo.error.reintentar}
      </Button>
    </div>
  );
}
