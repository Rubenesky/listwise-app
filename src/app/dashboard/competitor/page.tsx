"use client";

import { useEffect, useRef, useState } from "react";
import CreditsPopover from "@/components/CreditsPopover";

interface AnalysisResult {
  id: string;
  url: string;
  status: string;
  scrapedTitle: string | null;
  scrapedDescription: string | null;
  scrapedKeywords: string | null;
  analysis: {
    tone: string;
    strengths: string[];
    weaknesses: string[];
    keywords: string[];
    suggestions: string[];
  } | null;
  errorMessage: string | null;
  createdAt: number;
}

interface HistoryItem {
  id: string;
  url: string;
  status: string;
  scrapedTitle: string | null;
  createdAt: number;
}

interface Listing {
  id: string;
  productName: string;
  generatedTitle: string | null;
  status: string;
}

export default function CompetitorPage() {
  const [url, setUrl] = useState("");
  const [selectedListingId, setSelectedListingId] = useState("");
  const [listings, setListings] = useState<Listing[]>([]);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetch("/api/listings/dashboard?page=1&limit=50")
      .then((r) => r.json())
      .then((d) => {
        const done = (d.listings ?? []).filter((l: Listing) => l.status === "COMPLETED");
        setListings(done);
      })
      .catch(() => {});

    loadHistory();
    return () => stopPolling();
  }, []);

  function loadHistory() {
    fetch("/api/competitor/history")
      .then((r) => r.json())
      .then((d) => setHistory(d.analyses ?? []))
      .catch(() => {});
  }

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }

  function startPolling(id: string) {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/competitor/status/${id}`);
        if (!res.ok) return;
        const data: AnalysisResult = await res.json();
        setResult(data);
        if (data.status === "COMPLETED" || data.status === "FAILED") {
          stopPolling();
          setLoading(false);
          loadHistory();
        }
      } catch {
        // transient error — keep polling
      }
    }, 3000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    setError("");
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch("/api/competitor/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmedUrl, listingId: selectedListingId || undefined }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error al iniciar el análisis");
        setLoading(false);
        return;
      }

      setAnalysisId(data.analysisId);

      if (data.cached) {
        const statusRes = await fetch(`/api/competitor/status/${data.analysisId}`);
        if (statusRes.ok) {
          setResult(await statusRes.json());
        }
        setLoading(false);
      } else {
        startPolling(data.analysisId);
      }
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
      setLoading(false);
    }
  }

  async function loadFromHistory(item: HistoryItem) {
    setError("");
    setLoading(true);
    setAnalysisId(item.id);
    setUrl(item.url);
    try {
      const res = await fetch(`/api/competitor/status/${item.id}`);
      if (res.ok) setResult(await res.json());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">🔍 Análisis de Competencia</h1>
          <p className="mt-1 text-sm text-gray-600">
            Analiza el listing de un competidor con IA y obtén sugerencias para mejorar el tuyo. Máximo 5 análisis por día.
          </p>
        </div>
        <CreditsPopover />
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">URL del competidor *</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.amazon.es/dp/..."
            required
            maxLength={2048}
            className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">Solo URLs públicas. No se permiten IPs ni localhost.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Comparar con mi listing (opcional)
          </label>
          <select
            value={selectedListingId}
            onChange={(e) => setSelectedListingId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">— Sin comparativa —</option>
            {listings.map((l) => (
              <option key={l.id} value={l.id}>
                {l.productName}
                {l.generatedTitle ? ` — "${l.generatedTitle.slice(0, 40)}..."` : ""}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Analizando...
            </span>
          ) : (
            "Analizar competidor"
          )}
        </button>
      </form>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {result.status === "PROCESSING" || result.status === "PENDING" ? (
            <div className="bg-white rounded-xl border p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
              <p className="text-gray-600 text-sm">Analizando la página del competidor...</p>
            </div>
          ) : result.status === "FAILED" ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <p className="font-medium text-red-700">Error al analizar</p>
              <p className="text-sm text-red-600 mt-1">{result.errorMessage ?? "No se pudo completar el análisis."}</p>
            </div>
          ) : result.analysis ? (
            <>
              {/* Scraped content */}
              <div className="bg-white rounded-xl border p-5">
                <h2 className="font-semibold text-gray-900 mb-3">📄 Contenido del competidor</h2>
                <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline block truncate mb-3">
                  {result.url}
                </a>
                <div className="space-y-2 text-sm">
                  {result.scrapedTitle && (
                    <p><span className="font-medium text-gray-700">Título: </span><span className="text-gray-600">{result.scrapedTitle}</span></p>
                  )}
                  {result.scrapedDescription && (
                    <p><span className="font-medium text-gray-700">Descripción: </span><span className="text-gray-600">{result.scrapedDescription}</span></p>
                  )}
                  {result.scrapedKeywords && (
                    <p><span className="font-medium text-gray-700">Meta keywords: </span><span className="text-gray-500 text-xs">{result.scrapedKeywords}</span></p>
                  )}
                </div>
                <span className="mt-3 inline-flex items-center px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
                  Tono: {result.analysis.tone}
                </span>
              </div>

              {/* Side-by-side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                    <h3 className="font-semibold text-green-800 mb-3">✅ Fortalezas del competidor</h3>
                    <ul className="space-y-1.5">
                      {result.analysis.strengths.map((s, i) => (
                        <li key={i} className="text-sm text-green-700 flex items-start gap-1.5">
                          <span className="shrink-0">•</span><span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                    <h3 className="font-semibold text-red-800 mb-3">⚠️ Debilidades del competidor</h3>
                    <ul className="space-y-1.5">
                      {result.analysis.weaknesses.map((w, i) => (
                        <li key={i} className="text-sm text-red-700 flex items-start gap-1.5">
                          <span className="shrink-0">•</span><span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                    <h3 className="font-semibold text-blue-800 mb-3">🔑 Keywords detectadas</h3>
                    <div className="flex flex-wrap gap-2">
                      {result.analysis.keywords.map((kw, i) => (
                        <span key={i} className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{kw}</span>
                      ))}
                    </div>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
                    <h3 className="font-semibold text-yellow-800 mb-3">💡 Sugerencias para tu listing</h3>
                    <ol className="space-y-2">
                      {result.analysis.suggestions.map((s, i) => (
                        <li key={i} className="text-sm text-yellow-800 flex items-start gap-2">
                          <span className="font-bold text-yellow-600 shrink-0">{i + 1}.</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold text-gray-900 mb-4">📋 Historial de análisis</h2>
          <div className="space-y-2">
            {history.map((item) => (
              <button
                key={item.id}
                onClick={() => loadFromHistory(item)}
                className={`w-full text-left flex items-center justify-between gap-4 px-4 py-3 rounded-lg border transition-colors hover:bg-gray-50 ${
                  analysisId === item.id ? "border-blue-300 bg-blue-50" : "border-gray-200"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.scrapedTitle ?? item.url}</p>
                  <p className="text-xs text-gray-400 truncate">{item.url}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    item.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                    item.status === "FAILED" ? "bg-red-100 text-red-700" :
                    "bg-yellow-100 text-yellow-700"
                  }`}>
                    {item.status === "COMPLETED" ? "Completado" : item.status === "FAILED" ? "Error" : "En proceso"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date((item.createdAt ?? 0) * 1000).toLocaleDateString("es-ES")}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
