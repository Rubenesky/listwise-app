"use client";

import { useState, useEffect, useCallback } from "react";
import { Eye, Sparkles, Copy, Check, Loader2 } from "lucide-react";
import AgentChat from "./AgentChat";

interface PreviewData {
  id: string;
  productName: string;
  category: string | null;
  attributes: unknown;
  generatedTitle: string | null;
  generatedBullets: string[] | null;
  generatedDescription: string | null;
  selectedVariant: string | null;
  status: string;
}

interface Variant {
  id: string;
  style: string;
  title: string;
  bullets: string[];
  description: string;
}

const STYLE_ICONS: Record<string, string> = {
  creativo: "🎨",
  profesional: "💼",
  seo: "📈",
};

export default function LivePreview({ productId }: { productId: string }) {
  const [product, setProduct] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!productId) {
      setProduct(null);
      setVariants([]);
      setSelectedVariant(null);
      return;
    }

    setLoading(true);
    setVariants([]);
    setSelectedVariant(null);
    setIsEditing(false);
    setGeneratingStep(0);

    fetch(`/api/listings/${productId}/preview`)
      .then((r) => r.json())
      .then((data: PreviewData) => {
        setProduct(data);
        setEditContent(data.generatedDescription ?? "");
      })
      .catch((err) => console.error("[LivePreview] Error cargando producto:", err))
      .finally(() => setLoading(false));
  }, [productId]);

  const generateVariants = async () => {
    if (!productId) return;
    setIsGenerating(true);
    setGeneratingStep(0);
    setVariants([]);
    setSelectedVariant(null);

    // Simulate progress while waiting for the 3 sequential Groq calls
    const progressTimer = setInterval(() => {
      setGeneratingStep((s) => Math.min(s + 1, 2));
    }, 3000);

    try {
      const res = await fetch(`/api/listings/${productId}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 3 }),
      });

      if (res.status === 429) {
        const data = await res.json();
        alert(data.error ?? "Has generado demasiadas variantes. Espera un momento.");
        return;
      }

      const data = await res.json();
      const newVariants: Variant[] = data.variants ?? [];
      setVariants(newVariants);
      if (newVariants.length > 0) {
        setSelectedVariant(newVariants[0]);
        setEditContent(newVariants[0].description);
      }
    } catch (err) {
      console.error("[LivePreview] Error generando variantes:", err);
      alert("Error al generar variantes. Inténtalo de nuevo.");
    } finally {
      clearInterval(progressTimer);
      setIsGenerating(false);
      setGeneratingStep(3);
    }
  };

  const selectVariant = (v: Variant) => {
    setSelectedVariant(v);
    setEditContent(v.description);
    setIsEditing(false);
  };

  const saveDescription = async () => {
    if (!productId || !product) return;
    const title = selectedVariant?.title ?? product.generatedTitle ?? "";
    const bullets = selectedVariant?.bullets ?? product.generatedBullets ?? [];
    try {
      const res = await fetch(`/api/listings/${productId}/save`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          bullets,
          description: editContent,
          variantId: selectedVariant?.id ?? null,
          style: selectedVariant?.style ?? null,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setProduct({ ...product, generatedTitle: title, generatedBullets: bullets, generatedDescription: editContent, selectedVariant: selectedVariant?.id ?? null });
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error("[LivePreview] Error guardando:", err);
    }
  };

  const copyToClipboard = () => {
    const text = editContent || product?.generatedDescription || "";
    if (text) navigator.clipboard.writeText(text);
  };

  const handleApplyChanges = useCallback(
    (changes: { title?: string | null; bullets?: string[] | null; description?: string | null }) => {
      setProduct((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          generatedTitle: changes.title ?? prev.generatedTitle,
          generatedBullets: changes.bullets ?? prev.generatedBullets,
          generatedDescription: changes.description ?? prev.generatedDescription,
        };
      });
      if (changes.description) {
        setEditContent(changes.description);
        setIsEditing(false);
      }
    },
    []
  );

  if (!productId) {
    return (
      <div className="border rounded-lg bg-white shadow-sm flex items-center justify-center py-16 text-center">
        <div>
          <Eye className="h-10 w-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-400">Haz clic en un producto para ver la vista previa</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="border rounded-lg bg-white shadow-sm flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2 text-sm text-gray-500">Cargando producto...</span>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="border rounded-lg bg-white shadow-sm flex items-center justify-center py-16">
        <p className="text-sm text-gray-400">Producto no encontrado</p>
      </div>
    );
  }

  const displayTitle = selectedVariant?.title ?? product.generatedTitle;
  const displayBullets = selectedVariant?.bullets ?? product.generatedBullets ?? [];
  const displayDescription = isEditing
    ? editContent
    : (selectedVariant?.description ?? product.generatedDescription ?? "");

  return (
    <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gray-50 flex justify-between items-center">
        <div className="flex items-center gap-2 min-w-0">
          <Eye className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="font-semibold text-gray-900 text-sm">Vista Previa</span>
          <span className="text-xs text-gray-400">|</span>
          <span className="text-xs text-gray-500 truncate">{product.productName}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saved && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <Check className="h-3 w-3" /> Guardado
            </span>
          )}
          <button
            onClick={copyToClipboard}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100"
            title="Copiar descripción"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {product.status !== "COMPLETED" ? (
          <div className="text-center py-8 text-gray-500">
            <Loader2 className="h-7 w-7 animate-spin mx-auto mb-2 text-blue-500" />
            <p className="text-sm">Producto en proceso de generación...</p>
          </div>
        ) : (
          <>
            {/* Título */}
            {displayTitle && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase mb-1">Título</p>
                <p className="text-sm font-semibold text-gray-900 leading-snug">{displayTitle}</p>
              </div>
            )}

            {/* Bullets */}
            {displayBullets.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase mb-1">Bullets</p>
                <ul className="space-y-1">
                  {displayBullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-sm text-gray-700">
                      <span className="text-blue-500 mt-0.5 shrink-0">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Descripción */}
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase mb-1">Descripción</p>
              {isEditing ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full border rounded-lg p-2 text-sm text-gray-700 min-h-[120px] focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              ) : (
                <p className="text-sm text-gray-700 leading-relaxed">{displayDescription}</p>
              )}
            </div>

            {/* Acciones */}
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                {isEditing ? "🔍 Ver" : "✏️ Editar"}
              </button>

              {isEditing && (
                <button
                  onClick={saveDescription}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  💾 Guardar
                </button>
              )}

              <button
                onClick={generateVariants}
                disabled={isGenerating}
                className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-purple-400 flex items-center gap-1.5"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Generando variante {Math.min(generatingStep + 1, 3)}/3...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3" /> Variantes
                  </>
                )}
              </button>
            </div>

            {/* Progress bar while generating */}
            {isGenerating && (
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Generando variantes...</span>
                  <span>{Math.round((generatingStep / 3) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-purple-600 h-1.5 rounded-full transition-all duration-1000"
                    style={{ width: `${(generatingStep / 3) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Variant chips */}
            {variants.length > 0 && (
              <div className="pt-1">
                <p className="text-xs font-medium text-gray-400 uppercase mb-1.5">
                  Variantes ({variants.length})
                </p>
                <div className="flex gap-2 flex-wrap">
                  {variants.map((v, i) => (
                    <button
                      key={v.id}
                      onClick={() => selectVariant(v)}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        selectedVariant?.id === v.id
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {STYLE_ICONS[v.style] ?? ""} Versión {i + 1}
                    </button>
                  ))}
                </div>
                {selectedVariant && (
                  <button
                    onClick={saveDescription}
                    className="mt-2 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    💾 Guardar variante seleccionada
                  </button>
                )}
              </div>
            )}

            {/* Agent AI Chat — floating widget with product context */}
            <AgentChat
              listingId={product.id}
              productName={product.productName}
              onApplyChanges={handleApplyChanges}
            />
          </>
        )}
      </div>
    </div>
  );
}
