"use client";

import { useState } from "react";

interface AudioListing {
  id: string;
  productName: string;
  generatedTitle: string | null;
}

interface AudioFeatureBannerProps {
  listings: AudioListing[];
  // "card": collapsible dashboard card with its own header (default).
  // "inline": just the content, no header/toggle — for the dedicated page,
  // which already provides its own <h1>.
  variant?: "card" | "inline";
}

export default function AudioFeatureBanner({ listings, variant = "card" }: AudioFeatureBannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setError(null);
  };

  const handleGenerateAudio = async () => {
    if (!selectedId) return;
    setError(null);
    setGeneratingAudio(true);
    try {
      const res = await fetch(`/api/listings/${selectedId}/audio`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Error al generar el audio.");
        return;
      }
      const remaining = res.headers.get("X-Remaining-Credits");
      if (remaining !== null) {
        const n = Number(remaining);
        if (!Number.isNaN(n)) {
          window.dispatchEvent(new CustomEvent("credits-update", { detail: { credits: n } }));
        }
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("X-Filename") || "listing.wav";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Error de red al generar el audio. Inténtalo de nuevo.");
    } finally {
      setGeneratingAudio(false);
    }
  };

  const content = (
    <div className={variant === "card" ? "border-t border-blue-100 px-4 pb-4 pt-3 space-y-3 bg-white/60" : "space-y-3"}>
      <div>
        <p className="text-sm font-semibold text-gray-800">
          Tu ficha, lista para hablar como un vendedor de verdad.
        </p>
        <p className="text-xs text-gray-600 leading-relaxed mt-1">
          Genera en segundos un audio comercial con IA a partir del título, los bullets y la descripción que ya
          tienes — sin tono de anuncio, listo para enviar por WhatsApp u otras plataformas.{" "}
          <span className="font-medium text-blue-700">2 créditos por generación.</span>
        </p>
      </div>

      {listings.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-blue-300 p-4 text-center">
          <p className="text-sm text-gray-600">Aún no tienes productos completados.</p>
          <p className="text-xs text-gray-400 mt-0.5">Genera tu primer listing para poder crear su audio comercial.</p>
        </div>
      ) : (
        <div className="space-y-3 border border-blue-200 rounded-xl p-3 bg-white">
          <select
            value={selectedId}
            onChange={(e) => handleSelect(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Elige un producto…</option>
            {listings.map((l) => (
              <option key={l.id} value={l.id}>{l.generatedTitle ?? l.productName}</option>
            ))}
          </select>

          {selectedId && (
            <button
              onClick={handleGenerateAudio}
              disabled={generatingAudio}
              className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors font-medium"
            >
              {generatingAudio ? "Generando…" : "🔊 Generar audio"}
            </button>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );

  if (variant === "inline") {
    return content;
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/40 transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base">🎙️</span>
          <span className="text-sm font-semibold text-gray-800">Audio Comercial</span>
          <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">Nuevo</span>
        </div>
        <svg
          className={`w-4 h-4 text-blue-400 transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && content}
    </div>
  );
}
