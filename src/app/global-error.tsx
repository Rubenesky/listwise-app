"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", margin: 0, background: "#f9fafb" }}>
        <div style={{ textAlign: "center", padding: "32px", maxWidth: "400px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#111827", marginBottom: "8px" }}>
            Algo salió mal
          </h2>
          <p style={{ color: "#6b7280", fontSize: "14px", marginBottom: "24px" }}>
            Hemos recibido el error automáticamente. Puedes intentarlo de nuevo o volver al inicio.
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button
              onClick={reset}
              style={{ padding: "10px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}
            >
              Intentar de nuevo
            </button>
            <a
              href="/"
              style={{ padding: "10px 20px", background: "#f3f4f6", color: "#374151", textDecoration: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 600 }}
            >
              Ir al inicio
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
