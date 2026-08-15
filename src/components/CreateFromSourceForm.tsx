"use client";

import { useRef, useState } from "react";
import InfoTooltip from "@/components/InfoTooltip";

interface ProductInfo {
  productName: string;
  category: string;
  attributes: Record<string, string>;
  primaryKeyword: string;
  confidence: number;
}

interface Props {
  selectedMode: string;
  marketplace: string;
  priceSegment: string;
  onListingCreated: () => void;
}

function ConfidenceDot({ value }: { value: number }) {
  const color = value >= 0.75 ? "bg-green-500" : value >= 0.45 ? "bg-yellow-400" : "bg-red-500";
  const label = value >= 0.75 ? "Alta confianza" : value >= 0.45 ? "Confianza media" : "Baja confianza";
  return (
    <span className="flex items-center gap-1.5 text-sm text-gray-500">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
      {label} ({Math.round(value * 100)}%)
    </span>
  );
}

export default function CreateFromSourceForm({ selectedMode, marketplace, priceSegment, onListingCreated }: Props) {
  const [tab, setTab] = useState<"url" | "pdf">("url");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "analyzing" | "preview" | "creating" | "error">("idle");
  const [info, setInfo] = useState<ProductInfo | null>(null);
  const [editedName, setEditedName] = useState("");
  const [editedAttributes, setEditedAttributes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setState("idle");
    setInfo(null);
    setEditedName("");
    setEditedAttributes({});
    setError(null);
    setUrl("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleAnalyze() {
    if (tab === "url" && !url.trim()) return;
    if (tab === "pdf" && !file) return;
    setState("analyzing");
    setError(null);
    const fd = new FormData();
    if (tab === "url") fd.append("url", url.trim());
    else if (file) fd.append("file", file);

    try {
      const res = await fetch("/api/listings/analyze-source", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo analizar la fuente.");
        setState("error");
        return;
      }
      setInfo(data.productInfo);
      setEditedName(data.productInfo.productName);
      setEditedAttributes(data.productInfo.attributes ?? {});
      setState("preview");
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
      setState("error");
    }
  }

  async function handleCreate() {
    if (!info) return;
    setState("creating");
    setError(null);
    try {
      const res = await fetch("/api/listings/create-from-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: editedName || info.productName,
          category: info.category,
          attributes: editedAttributes,
          primaryKeyword: info.primaryKeyword,
          mode: selectedMode,
          marketplace,
          priceSegment,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo crear el producto.");
        setState("preview");
        return;
      }
      if (typeof data.remainingCredits === "number") {
        window.dispatchEvent(new CustomEvent("credits-update", { detail: { credits: data.remainingCredits } }));
      }
      reset();
      onListingCreated();
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
      setState("preview");
    }
  }

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-1.5">
        <p className="text-sm font-medium text-gray-700">o crea un producto desde una URL o un PDF</p>
        <InfoTooltip content="Pega la URL de la ficha de un proveedor (o sube su PDF) y la IA extrae automáticamente el nombre, la categoría y los atributos del producto para rellenar el formulario — te ahorra escribirlo a mano antes de generar la ficha." />
      </div>

      {(state === "idle" || state === "error") && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => setTab("url")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === "url" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"}`}
            >
              🔗 Pegar URL
            </button>
            <button
              onClick={() => setTab("pdf")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === "pdf" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"}`}
            >
              📄 Subir PDF
            </button>
          </div>

          {tab === "url" ? (
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://proveedor.com/ficha-del-producto"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          ) : (
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
            />
          )}

          <button
            onClick={handleAnalyze}
            disabled={(tab === "url" && !url.trim()) || (tab === "pdf" && !file) || (state as string) === "analyzing"}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {(state as string) === "analyzing" ? "Analizando..." : "Analizar"}
          </button>
          {state === "error" && error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      {state === "analyzing" && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
          Analizando fuente...
        </div>
      )}

      {(state === "preview" || state === "creating") && info && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Nombre del producto</label>
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              maxLength={200}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Categoría</span>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 capitalize">
              {info.category}
            </span>
          </div>

          {Object.keys(editedAttributes).length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Atributos</p>
              <div className="space-y-1.5">
                {Object.entries(editedAttributes).map(([key, value]) => (
                  <div key={key} className="flex gap-2 items-center">
                    <span className="text-xs text-gray-500 w-24 shrink-0 capitalize">{key}</span>
                    <input
                      className="flex-1 border rounded px-2 py-1 text-sm"
                      value={value}
                      onChange={(e) => setEditedAttributes((prev) => ({ ...prev, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <ConfidenceDot value={info.confidence} />
          {info.confidence < 0.45 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚠️ Confianza baja — revisa todos los campos antes de crear el producto.
            </p>
          )}

          <p className="text-xs text-gray-400">
            Esto creará el producto y consumirá {selectedMode === "tecnica" ? "2 créditos" : "1 crédito"} para generar su ficha.
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCreate}
              disabled={state === "creating"}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {state === "creating" ? "Creando..." : "Crear producto →"}
            </button>
            <button
              onClick={reset}
              disabled={state === "creating"}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
