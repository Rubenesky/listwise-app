"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] Unhandled error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-xl font-semibold">Algo salió mal</h2>
      <p className="text-muted-foreground max-w-sm text-sm">
        Se produjo un error inesperado. Puedes intentar recargar la sección.
      </p>
      <button
        onClick={reset}
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors"
      >
        Reintentar
      </button>
    </div>
  );
}
