"use client";

import { useState } from "react";

interface CounterPositioningResult {
  competitorWeaknesses: string[];
  counterBullets: string[];
  counterTitle: string;
  summary: string;
}

interface CounterPositioningProps {
  listingId: string;
  competitorId: string;
  competitorTitle: string;
  onApplyBullets: (bullets: string[]) => void;
  onApplyTitle: (title: string) => void;
}

export function CounterPositioning({
  listingId,
  competitorId,
  competitorTitle,
  onApplyBullets,
  onApplyTitle,
}: CounterPositioningProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CounterPositioningResult | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/competitor/counter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, competitorId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error al generar el análisis");
        return;
      }

      setResult(data as CounterPositioningResult);
      setCollapsed(false);
    } catch {
      setError("Error de red. Por favor intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md border border-blue-500 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Analizando competidor..." : "⚔️ Generar vs competidor (2 créditos)"}
      </button>

      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}

      {result && !collapsed && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-800">
              Contra-posicionamiento vs. {competitorTitle}
            </h3>
            <button
              onClick={() => setCollapsed(true)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Ocultar
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            <section className="px-4 py-3">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Debilidades del competidor
              </h4>
              <ul className="space-y-1">
                {result.competitorWeaknesses.map((weakness, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-0.5 text-red-500">🔴</span>
                    {weakness}
                  </li>
                ))}
              </ul>
            </section>

            <section className="px-4 py-3">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Tus bullets de contra-posicionamiento
              </h4>
              <ul className="space-y-2">
                {result.counterBullets.map((bullet, i) => (
                  <li key={i} className="flex items-start justify-between gap-3">
                    <span className="text-sm text-gray-700">{bullet}</span>
                    <button
                      onClick={() => onApplyBullets([bullet])}
                      className="shrink-0 rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                    >
                      Añadir →
                    </button>
                  </li>
                ))}
              </ul>
              {result.counterBullets.length > 0 && (
                <button
                  onClick={() => onApplyBullets(result.counterBullets)}
                  className="mt-3 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  Aplicar todos los bullets
                </button>
              )}
            </section>

            <section className="px-4 py-3">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Título alternativo
              </h4>
              <div className="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2">
                <p className="text-sm font-medium text-gray-800">{result.counterTitle}</p>
                <button
                  onClick={() => onApplyTitle(result.counterTitle)}
                  className="shrink-0 rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  Aplicar título
                </button>
              </div>
            </section>

            <section className="px-4 py-3">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Resumen
              </h4>
              <p className="text-sm text-gray-700">{result.summary}</p>
            </section>
          </div>
        </div>
      )}

      {result && collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="mt-2 text-xs text-blue-500 hover:text-blue-700"
        >
          Mostrar análisis
        </button>
      )}
    </div>
  );
}
