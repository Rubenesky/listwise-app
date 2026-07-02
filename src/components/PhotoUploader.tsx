"use client";

import { useRef, useState } from "react";

interface PhotoAnalysis {
  productName: string;
  category: string;
  attributes: Record<string, string>;
  primaryKeyword: string;
  confidence: number;
}

interface Props {
  onListingCreated: () => void;
}

function ConfidenceDot({ value }: { value: number }) {
  const color =
    value >= 0.75
      ? "bg-green-500"
      : value >= 0.45
      ? "bg-yellow-400"
      : "bg-red-500";
  const label =
    value >= 0.75 ? "Alta confianza" : value >= 0.45 ? "Confianza media" : "Baja confianza";
  return (
    <span className="flex items-center gap-1.5 text-sm text-gray-500">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
      {label} ({Math.round(value * 100)}%)
    </span>
  );
}

export default function PhotoUploader({ onListingCreated }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<
    "idle" | "analyzing" | "preview" | "creating" | "error"
  >("idle");
  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null);
  const [editedName, setEditedName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setState("idle");
    setAnalysis(null);
    setEditedName("");
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setState("analyzing");
    setError(null);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/upload/photo", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error ?? "Error al analizar la imagen.");
        setState("error");
        return;
      }

      setAnalysis(data.analysis);
      setEditedName(data.analysis.productName);
      setState("preview");
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
      setState("error");
    }
  }

  async function handleCreate() {
    if (!analysis) return;
    setState("creating");

    try {
      const res = await fetch("/api/listings/from-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: editedName || analysis.productName,
          category: analysis.category,
          attributes: analysis.attributes,
          primaryKeyword: analysis.primaryKeyword,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error ?? "No se pudo crear el listing.");
        setState("error");
        return;
      }

      reset();
      onListingCreated();
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
      setState("error");
    }
  }

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {(state === "idle" || state === "error") && (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            📷 Subir foto
          </button>
          {state === "error" && error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>
      )}

      {state === "analyzing" && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
          Analizando imagen...
        </div>
      )}

      {(state === "preview" || state === "creating") && analysis && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
              Nombre del producto
            </label>
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              maxLength={200}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Categoría
            </span>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 capitalize">
              {analysis.category}
            </span>
          </div>

          {Object.keys(analysis.attributes).length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Atributos
              </p>
              <ul className="space-y-0.5">
                {Object.entries(analysis.attributes).map(([key, value]) => (
                  <li key={key} className="flex gap-1.5 text-sm text-gray-700">
                    <span className="font-medium capitalize">{key}:</span>
                    <span>{value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-gray-700">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Keyword SEO:
            </span>
            <span>{analysis.primaryKeyword}</span>
          </div>

          <ConfidenceDot value={analysis.confidence} />

          {state === "error" && error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCreate}
              disabled={state === "creating"}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {state === "creating" ? "Creando..." : "Crear listing con estos datos →"}
            </button>
            <button
              onClick={reset}
              disabled={state === "creating"}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
