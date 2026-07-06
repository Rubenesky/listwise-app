"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] Unhandled error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 text-center px-4">
      <div className="flex flex-col items-center gap-2">
        <span className="text-5xl font-bold text-destructive">500</span>
        <h1 className="text-2xl font-semibold">Algo salió mal</h1>
        <p className="text-muted-foreground max-w-md text-sm">
          Ocurrió un error inesperado. Si el problema persiste, contacta soporte.
        </p>
        {error.digest && (
          <p className="text-muted-foreground font-mono text-xs">
            Referencia: {error.digest}
          </p>
        )}
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-5 py-2 text-sm font-medium transition-colors"
        >
          Reintentar
        </button>
        <a
          href="/"
          className="border border-input bg-background hover:bg-accent rounded-md px-5 py-2 text-sm font-medium transition-colors"
        >
          Volver al inicio
        </a>
      </div>
    </div>
  );
}
