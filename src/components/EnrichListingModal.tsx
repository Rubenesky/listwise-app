"use client";

import { useState, useEffect } from "react";

interface AttributeConflict {
  key: string;
  manualValue: string;
  extractedValue: string;
}

interface PreviewState {
  sourceId: string;
  extractedSpecs: Record<string, string>;
  conflicts: AttributeConflict[];
}

interface Props {
  listingId: string;
  productName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EnrichListingModal({ listingId, productName, onClose, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [editedSpecs, setEditedSpecs] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "checking" | "extracting" | "confirming" | "error">("checking");
  const [error, setError] = useState<string | null>(null);
  const [reusedCachedSource, setReusedCachedSource] = useState(false);

  // Decision #7 (reutilización de fuente): antes de pedir subir un PDF, mira
  // si ya hay una fuente extraída y vigente (< 30 días) para este listing.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/listings/${listingId}/enrich`);
        const data = await res.json();
        if (!cancelled && res.ok && data.found) {
          setPreview({ sourceId: data.sourceId, extractedSpecs: data.extractedSpecs, conflicts: data.conflicts });
          setEditedSpecs(data.extractedSpecs);
          setReusedCachedSource(true);
        }
      } finally {
        if (!cancelled) setStatus("idle");
      }
    })();
    return () => { cancelled = true; };
  }, [listingId]);

  function startFresh() {
    setPreview(null);
    setReusedCachedSource(false);
    setFile(null);
  }

  async function handleExtract() {
    if (!file || !consent) return;
    setStatus("extracting");
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`/api/listings/${listingId}/enrich`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo procesar el PDF.");
        setStatus("error");
        return;
      }
      setPreview({ sourceId: data.sourceId, extractedSpecs: data.extractedSpecs, conflicts: data.conflicts });
      setEditedSpecs(data.extractedSpecs);
      setStatus("idle");
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
      setStatus("error");
    }
  }

  async function handleConfirm() {
    if (!preview || !consent) return;
    setStatus("confirming");
    setError(null);
    try {
      const res = await fetch(`/api/listings/${listingId}/enrich/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: preview.sourceId, editedSpecs, consent: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo regenerar el producto.");
        setStatus("error");
        return;
      }
      onSuccess();
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
      setStatus("error");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 max-w-lg w-full space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900">Enriquecer &quot;{productName}&quot; con PDF de proveedor</h3>

        {status === "checking" && <p className="text-sm text-gray-500">Comprobando fuentes guardadas...</p>}

        {status !== "checking" && !preview && (
          <>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
            />
            <label className="flex items-start gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5"
              />
              Confirmo que tengo derecho a usar este documento.
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">
                Cancelar
              </button>
              <button
                onClick={handleExtract}
                disabled={!file || !consent || status === "extracting"}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                {status === "extracting" ? "Leyendo PDF..." : "Extraer especificaciones"}
              </button>
            </div>
          </>
        )}

        {preview && (
          <>
            {reusedCachedSource && (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                <p className="text-xs text-blue-700">Reutilizando una fuente que ya subiste antes (vigente 30 días).</p>
                <button onClick={startFresh} className="text-xs text-blue-700 underline shrink-0 ml-2">
                  Subir otro PDF
                </button>
              </div>
            )}
            <p className="text-sm text-gray-600">
              Especificaciones detectadas — puedes corregirlas antes de regenerar:
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {Object.entries(editedSpecs).map(([key, value]) => (
                <div key={key} className="flex gap-2 items-center">
                  <span className="text-xs font-medium text-gray-500 w-28 shrink-0">{key}</span>
                  <input
                    className="flex-1 border rounded px-2 py-1 text-sm"
                    value={value}
                    onChange={(e) => setEditedSpecs((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            {preview.conflicts.length > 0 && (
              <p className="text-xs text-amber-600">
                {preview.conflicts.length} valor{preview.conflicts.length === 1 ? "" : "es"} de la fuente no se
                usó porque ya tenías un dato manual distinto.
              </p>
            )}
            {!reusedCachedSource && (
              <label className="flex items-start gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5"
                />
                Confirmo que tengo derecho a usar este documento.
              </label>
            )}
            <p className="text-xs text-gray-400">
              Esto regenerará el producto por el mismo coste en créditos que ya tiene — sin cargo adicional por usar esta fuente.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={status === "confirming" || (!reusedCachedSource && !consent)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                {status === "confirming" ? "Regenerando..." : "Confirmar y regenerar"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
