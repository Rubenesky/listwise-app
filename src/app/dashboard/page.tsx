"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState, useCallback, useRef } from "react";
import { useUserPlan } from "@/lib/hooks/useUserPlan";
import { PLAN_LIMITS } from "@/lib/constants";
import OnboardingTour from "@/components/OnboardingTour";
import VoiceProfileManager from "@/components/VoiceProfileManager";
import InfoTooltip from "@/components/InfoTooltip";
import LivePreview from "@/components/LivePreview";

type ListingStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
type GenerationMode = "creative" | "professional" | "seo";

interface ListingRow {
  id: string;
  productName: string;
  category: string | null;
  status: ListingStatus;
  generatedTitle: string | null;
  generatedBullets: string[] | null;
  generatedDescription: string | null;
  errorMessage: string | null;
}

const PLAN_LABELS: Record<string, string> = {
  free: "Gratuito",
  pro: "Pro",
  enterprise: "Empresa",
};

const PLAN_COLORS: Record<string, string> = {
  free: "bg-gray-100 text-gray-700",
  pro: "bg-blue-100 text-blue-700",
  enterprise: "bg-purple-100 text-purple-700",
};

const MODE_LABELS: Record<GenerationMode, string> = {
  creative: "🎨 Creativo",
  professional: "💼 Profesional",
  seo: "📈 SEO",
};

export default function DashboardPage() {
  const { isLoaded, isSignedIn } = useUser();
  const { plan, status, loading: planLoading } = useUserPlan();
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [credits, setCredits] = useState(0);
  const [selectedMode, setSelectedMode] = useState<GenerationMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("listwise_generation_mode");
      if (saved === "creative" || saved === "professional" || saved === "seo") return saved;
    }
    return "creative";
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchTotal, setBatchTotal] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Live preview
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // Modal state
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const selectedListing = listings.find((l) => l.id === selectedListingId) ?? null;
  const [editTitle, setEditTitle] = useState("");
  const [editBullets, setEditBullets] = useState<string[]>([]);
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState<string | null>(null);

  // Derived stats from listings state
  const completedCount = listings.filter((l) => l.status === "COMPLETED").length;
  const pendingOrProcessingCount = listings.filter(
    (l) => l.status === "PENDING" || l.status === "PROCESSING"
  ).length;
  const failedCount = listings.filter((l) => l.status === "FAILED").length;

  // Progress bar
  const processedInBatch = Math.max(0, batchTotal - pendingOrProcessingCount);
  const progressPct = batchTotal > 0 ? Math.round((processedInBatch / batchTotal) * 100) : 0;

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/listings/dashboard");
        if (!res.ok) return;
        const data: ListingRow[] = await res.json();
        setListings(data);
        const hasActive = data.some(
          (l) => l.status === "PENDING" || l.status === "PROCESSING"
        );
        if (!hasActive) {
          stopPolling();
          setIsProcessing(false);
        }
      } catch {
        // ignore transient polling errors
      }
    }, 4000);
  }, [stopPolling]);

  const fetchListings = useCallback(async () => {
    try {
      const res = await fetch("/api/listings/dashboard");
      if (!res.ok) return;
      const data: ListingRow[] = await res.json();
      setListings(data);
      const hasActive = data.some(
        (l) => l.status === "PENDING" || l.status === "PROCESSING"
      );
      if (hasActive) startPolling();
    } catch (error) {
      console.error("Error fetching listings:", error);
    } finally {
      setLoading(false);
    }
  }, [startPolling]);

  useEffect(() => {
    if (isSignedIn) fetchListings();
  }, [isSignedIn, fetchListings]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  useEffect(() => {
    localStorage.setItem("listwise_generation_mode", selectedMode);
  }, [selectedMode]);

  useEffect(() => {
    fetch("/api/referrals/credits")
      .then((r) => r.json())
      .then((d) => setCredits(d.credits ?? 0))
      .catch(() => {});
  }, []);

  const openModal = (listing: ListingRow) => {
    setSelectedListingId(listing.id);
    setEditTitle(listing.generatedTitle ?? "");
    setEditBullets(listing.generatedBullets ?? []);
    setEditDescription(listing.generatedDescription ?? "");
  };

  const closeModal = () => setSelectedListingId(null);

  const handleShare = async (listingId: string) => {
    setSharing(listingId);
    try {
      const res = await fetch(`/api/listings/${listingId}/share`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Error al generar el enlace de compartir.");
        return;
      }
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch {
      alert("Error de red al generar el enlace. Inténtalo de nuevo.");
    } finally {
      setSharing(null);
    }
  };

  const handleSave = async () => {
    if (!selectedListing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/listings/${selectedListing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generatedTitle: editTitle,
          generatedBullets: editBullets,
          generatedDescription: editDescription,
        }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      setListings((prev) =>
        prev.map((l) =>
          l.id === selectedListing.id
            ? {
                ...l,
                generatedTitle: editTitle,
                generatedBullets: editBullets,
                generatedDescription: editDescription,
              }
            : l
        )
      );
      closeModal();
    } catch {
      alert("Error al guardar los cambios. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.name.toLowerCase().endsWith(".csv")) {
      setFile(selectedFile);
    } else {
      alert("Por favor, selecciona un archivo CSV válido.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadErrors([]);
    setUploadWarnings([]);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", selectedMode);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.validationErrors?.length > 0) {
          setUploadErrors(data.validationErrors);
        } else {
          setUploadErrors([data.error || "Error al subir el archivo"]);
        }
        return;
      }
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (data.warnings?.length > 0) setUploadWarnings(data.warnings);
      // Start progress tracking for this batch
      setBatchTotal(data.count || 0);
      setIsProcessing(true);
      await fetchListings();
    } catch {
      setUploadErrors(["Error de red al subir el archivo. Inténtalo de nuevo."]);
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (s: ListingStatus) => {
    const styles: Record<ListingStatus, string> = {
      PENDING: "bg-yellow-100 text-yellow-800",
      PROCESSING: "bg-blue-100 text-blue-800",
      COMPLETED: "bg-green-100 text-green-800",
      FAILED: "bg-red-100 text-red-800",
    };
    const labels: Record<ListingStatus, string> = {
      PENDING: "Pendiente",
      PROCESSING: "Procesando",
      COMPLETED: "Completado",
      FAILED: "Fallido",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[s]}`}>
        {labels[s]}
      </span>
    );
  };

  if (!isLoaded || planLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  const planLabel = PLAN_LABELS[plan] || "Gratuito";
  const planColor = PLAN_COLORS[plan] || "bg-gray-100 text-gray-700";
  const planLimit = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] || 10;
  const currentCount = listings.length;
  const hasPendingOrProcessing = pendingOrProcessingCount > 0;

  return (
    <>
      <OnboardingTour />

      {/* Detail / Edit Modal */}
      {selectedListing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div className="flex items-center gap-3 min-w-0">
                <h2 className="text-lg font-semibold text-gray-900 truncate">
                  {selectedListing.productName}
                </h2>
                {getStatusBadge(selectedListing.status)}
              </div>
              <button
                onClick={closeModal}
                className="shrink-0 ml-3 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Cerrar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4">
              {(selectedListing.status === "PENDING" || selectedListing.status === "PROCESSING") && (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-3 text-gray-500">
                    {selectedListing.status === "PENDING"
                      ? "En cola — esperando procesamiento..."
                      : "Generando contenido con IA..."}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">El estado se actualizará automáticamente.</p>
                </div>
              )}

              {selectedListing.status === "FAILED" && (
                <div className="py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="mt-3 font-medium text-red-700">Error al procesar</p>
                  {selectedListing.errorMessage && (
                    <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">{selectedListing.errorMessage}</p>
                  )}
                </div>
              )}

              {selectedListing.status === "COMPLETED" && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Título optimizado</label>
                    <input
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      maxLength={200}
                    />
                    <p className="text-xs text-gray-400 mt-1">{editTitle.length}/200 caracteres</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bullet points ({editBullets.length})
                    </label>
                    <div className="space-y-2">
                      {editBullets.map((bullet, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="mt-2 text-xs text-gray-400 w-5 shrink-0 text-right">{i + 1}.</span>
                          <input
                            className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            value={bullet}
                            onChange={(e) => {
                              const next = [...editBullets];
                              next[i] = e.target.value;
                              setEditBullets(next);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                    <textarea
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      rows={7}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {selectedListing.status === "COMPLETED" && (
              <div className="px-6 py-4 border-t flex justify-end gap-3">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-sm border rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                >
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-0.5 text-sm text-gray-600">
              Sube tu catálogo en CSV y la IA generará títulos, bullets y descripciones optimizadas.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {credits > 0 && (
              <div className="text-right">
                <span className="text-xs text-gray-500">💰 Créditos</span>
                <p className="text-lg font-bold text-blue-600 leading-tight">{credits}</p>
              </div>
            )}
            <div className="text-right">
              <span className="text-sm text-gray-500">Plan actual</span>
              <div className={`mt-1 px-3 py-1 rounded-full text-sm font-medium ${planColor}`}>
                {planLabel}
              </div>
            </div>
            {status === "canceled" && (
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                Cancelado
              </span>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-lg border p-3 text-center">
            <p className="text-lg font-bold text-gray-900">{currentCount}</p>
            <p className="text-xs text-gray-500">Total productos</p>
          </div>
          <div className="bg-white rounded-lg border p-3 text-center">
            <p className="text-lg font-bold text-green-600">{completedCount}</p>
            <p className="text-xs text-gray-500">Completados</p>
          </div>
          <div className="bg-white rounded-lg border p-3 text-center">
            <p className="text-lg font-bold text-yellow-600">{pendingOrProcessingCount}</p>
            <p className="text-xs text-gray-500">Pendientes</p>
          </div>
          <div className="bg-white rounded-lg border p-3 text-center">
            <p className="text-lg font-bold text-red-600">{failedCount}</p>
            <p className="text-xs text-gray-500">Fallidos</p>
          </div>
        </div>

        {/* Plan limit bar */}
        <div className="bg-white rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-gray-600">
              Productos utilizados:{" "}
              <span className="font-semibold text-gray-900">{currentCount}</span>
              {planLimit !== Infinity && (
                <>
                  {" "}de{" "}
                  <span className="font-semibold text-gray-900">{planLimit}</span>
                </>
              )}
            </span>
            {planLimit !== Infinity && (
              <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all"
                  style={{ width: `${Math.min((currentCount / planLimit) * 100, 100)}%` }}
                />
              </div>
            )}
            {plan === "free" && (
              <a href="/pricing" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                Upgrade para más productos →
              </a>
            )}
          </div>
        </div>

        {/* Validation errors */}
        {uploadErrors.length > 0 && (
          <div className="border border-red-200 bg-red-50 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-800 mb-2">
                  {uploadErrors.length === 1
                    ? "El archivo tiene un error que debes corregir:"
                    : `El archivo tiene ${uploadErrors.length} errores que debes corregir:`}
                </p>
                <ul className="space-y-1">
                  {uploadErrors.map((err, i) => (
                    <li key={i} className="text-sm text-red-700 flex items-start gap-1.5">
                      <span className="shrink-0 mt-0.5">•</span>
                      <span>{err}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button onClick={() => setUploadErrors([])} className="shrink-0 text-red-400 hover:text-red-600" aria-label="Cerrar">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Validation warnings */}
        {uploadWarnings.length > 0 && (
          <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-yellow-800 mb-2">
                  Advertencias — los productos se han subido correctamente:
                </p>
                <ul className="space-y-1">
                  {uploadWarnings.map((w, i) => (
                    <li key={i} className="text-sm text-yellow-700 flex items-start gap-1.5">
                      <span className="shrink-0 mt-0.5">•</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button onClick={() => setUploadWarnings([])} className="shrink-0 text-yellow-400 hover:text-yellow-600" aria-label="Cerrar">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Upload section header */}
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-semibold text-gray-900">Subir CSV</h2>
          <a
            href="/api/template/csv"
            download="plantilla_listwise.csv"
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Descargar plantilla CSV
          </a>
        </div>

        {/* Upload area */}
        <div className="upload-area border-2 border-dashed border-gray-300 rounded-lg p-5 text-center hover:border-blue-500 transition-colors">
          <div className="flex flex-col items-center gap-2">
            {file ? (
              <>
                <p className="font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                <button
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Eliminar archivo
                </button>
              </>
            ) : (
              <>
                <svg className="w-9 h-9 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="font-medium text-gray-700">Arrastra tu CSV aquí</p>
                <p className="text-sm text-gray-500">o haz clic para seleccionar un archivo</p>
                <p className="text-xs text-gray-400">
                  Columna requerida:{" "}
                  <code className="bg-gray-100 px-1 rounded">productName</code>. Opciones:{" "}
                  <code className="bg-gray-100 px-1 rounded">category</code>,{" "}
                  <code className="bg-gray-100 px-1 rounded">attributes</code>
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Seleccionar archivo
              </button>
              {file && (
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:bg-blue-400"
                >
                  {uploading ? "Subiendo..." : "Subir y Procesar"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mode selector */}
        <div className="mode-selector">
          <div className="flex items-center gap-1.5 mb-2">
            <label className="text-sm font-medium text-gray-700">Modo de generación</label>
            <InfoTooltip content="El modo define el estilo de escritura de la IA. Se aplica a todos los productos del siguiente CSV que subas." />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(["creative", "professional", "seo"] as GenerationMode[]).map((mode) => {
              const modeTooltips: Record<GenerationMode, string> = {
                creative: "Tono emocional y narrativo. Conecta con las aspiraciones del cliente. Ideal para moda, lifestyle y regalos.",
                professional: "Tono técnico y formal. Destaca especificaciones y funcionalidad. Ideal para electrónica, herramientas y B2B.",
                seo: "Optimizado para buscadores. Incluye palabras clave estratégicas de forma natural. Ideal para posicionar en Google.",
              };
              return (
                <div key={mode} className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedMode(mode)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedMode === mode
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {MODE_LABELS[mode]}
                  </button>
                  <InfoTooltip content={modeTooltips[mode]} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Voice profile */}
        <VoiceProfileManager />

        {/* Progress bar */}
        {isProcessing && batchTotal > 0 && (
          <div className="bg-white rounded-lg border p-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                Procesando productos...
              </span>
              <span>{processedInBatch} de {batchTotal}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Listings table + Live Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="listings-table border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-gray-900">Tus listados</h2>
              {hasPendingOrProcessing && (
                <span className="flex items-center gap-1.5 text-xs text-blue-600">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                  Procesando automáticamente...
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">{listings.length} productos</span>
              {completedCount > 0 && (
                <a
                  href="/api/listings/export"
                  download="listwise_export.csv"
                  className="text-sm text-green-600 hover:text-green-800 flex items-center gap-1 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Exportar CSV
                </a>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : listings.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              Todavía no tienes listados. Sube un CSV para empezar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Producto</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Estado</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Título generado</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {listings.map((listing) => (
                    <tr
                      key={listing.id}
                      className={`hover:bg-gray-50 cursor-pointer ${selectedProductId === listing.id ? "bg-blue-50" : ""}`}
                      onClick={() => setSelectedProductId(listing.id)}
                    >
                      <td className="px-4 py-3 max-w-[200px]">
                        <button
                          onClick={(e) => { e.stopPropagation(); openModal(listing); }}
                          className="font-medium text-gray-900 hover:text-blue-600 text-left truncate w-full transition-colors"
                        >
                          {listing.productName}
                        </button>
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(listing.status)}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[300px] truncate">
                        {listing.generatedTitle || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); openModal(listing); }}
                            className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            {listing.status === "COMPLETED" ? "Editar" : "Ver"}
                          </button>
                          {listing.status === "COMPLETED" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleShare(listing.id); }}
                              disabled={sharing === listing.id}
                              className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
                              title="Compartir landing page"
                            >
                              {sharing === listing.id ? "..." : "🔗"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Live Preview panel */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <LivePreview productId={selectedProductId ?? ""} />
        </div>
        </div>
      </div>
    </>
  );
}
