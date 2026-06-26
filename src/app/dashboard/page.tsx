"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState, useCallback, useRef } from "react";
import { useUserPlan } from "@/lib/hooks/useUserPlan";
import { PLAN_LIMITS } from "@/lib/constants";
import OnboardingTour from "@/components/OnboardingTour";
import VoiceProfileManager from "@/components/VoiceProfileManager";
import InfoTooltip from "@/components/InfoTooltip";
import GamificationWidget from "@/components/GamificationWidget";
import CreditsPopover from "@/components/CreditsPopover";

type ListingStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
type GenerationMode = "creative" | "professional" | "seo";

interface QualityFlags {
  no_trademarks?: boolean;
  title_in_range?: boolean;
  bullets_concise?: boolean;
  attrs_real?: boolean;
  hook_differentiated?: boolean;
}

interface ListingRow {
  id: string;
  productName: string;
  category: string | null;
  status: ListingStatus;
  generatedTitle: string | null;
  generatedTitleB: string | null;
  generatedBullets: string[] | null;
  generatedDescription: string | null;
  errorMessage: string | null;
  userRating: number | null;
  primaryKeyword: string | null;
  hookType: string | null;
  qualityFlags: QualityFlags | null;
}

function calcHealthScore(listing: ListingRow): number {
  if (listing.status !== "COMPLETED") return 0;
  let score = 0;
  if (listing.generatedTitle) {
    score += 20;
    const len = listing.generatedTitle.length;
    if (len >= 60 && len <= 100) score += 15;
    else if (len >= 40) score += 8;
  }
  if (listing.generatedBullets) {
    if (listing.generatedBullets.length >= 4) score += 20;
    else if (listing.generatedBullets.length >= 2) score += 10;
  }
  if (listing.generatedDescription) {
    if (listing.generatedDescription.length >= 200) score += 20;
    else if (listing.generatedDescription.length >= 100) score += 10;
  }
  if (listing.primaryKeyword) score += 10;
  if (listing.hookType) score += 5;
  if (listing.generatedTitleB) score += 5;
  if (listing.qualityFlags?.no_trademarks) score += 3;
  if (listing.qualityFlags?.hook_differentiated) score += 2;
  return Math.min(100, score);
}

function getHealthLabel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: "Excelente", color: "text-green-700 bg-green-100" };
  if (score >= 70) return { label: "Bueno", color: "text-teal-700 bg-teal-100" };
  if (score >= 50) return { label: "Regular", color: "text-yellow-700 bg-yellow-100" };
  return { label: "Mejorable", color: "text-orange-700 bg-orange-100" };
}

const PLAN_LABELS: Record<string, string> = {
  free: "Gratuito",
  pro: "Pro",
  enterprise: "Enterprise",
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

  // Modal state
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const selectedListing = listings.find((l) => l.id === selectedListingId) ?? null;
  const [editTitle, setEditTitle] = useState("");
  const [editBullets, setEditBullets] = useState<string[]>([]);
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const aiProvider = "gemini";
  const currentPageRef = useRef(1);
  const [marketplace, setMarketplace] = useState<string>(() => {
    if (typeof window !== "undefined") return localStorage.getItem("listwise_marketplace") ?? "general";
    return "general";
  });
  const [priceSegment, setPriceSegment] = useState<string>(() => {
    if (typeof window !== "undefined") return localStorage.getItem("listwise_price_segment") ?? "";
    return "";
  });

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
        const res = await fetch(`/api/listings/dashboard?page=${currentPageRef.current}&limit=20`);
        if (!res.ok) return;
        const json = await res.json();
        const data: ListingRow[] = json.listings ?? [];
        setListings(data);
        if (json.pagination) setPagination(json.pagination);
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

  const fetchListings = useCallback(async (page = 1) => {
    currentPageRef.current = page;
    try {
      const res = await fetch(`/api/listings/dashboard?page=${page}&limit=20`);
      if (!res.ok) return;
      const json = await res.json();
      const data: ListingRow[] = json.listings ?? [];
      setListings(data);
      if (json.pagination) setPagination(json.pagination);
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
    localStorage.setItem("listwise_marketplace", marketplace);
  }, [marketplace]);

  useEffect(() => {
    localStorage.setItem("listwise_price_segment", priceSegment);
  }, [priceSegment]);

  const handleRate = async (listingId: string, rating: number | null) => {
    setListings((prev) =>
      prev.map((l) => (l.id === listingId ? { ...l, userRating: rating } : l))
    );
    try {
      await fetch(`/api/listings/${listingId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });
    } catch {
      fetchListings(currentPageRef.current);
    }
  };


  // Register referral code from localStorage after sign-up
  useEffect(() => {
    if (!isSignedIn) return;
    const refCode = localStorage.getItem("listwise_ref");
    if (!refCode) return;
    fetch("/api/referrals/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: refCode }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          window.dispatchEvent(new Event("gamification-update"));
        }
        // Clean up regardless: success or idempotent 409
        localStorage.removeItem("listwise_ref");
      })
      .catch(() => localStorage.removeItem("listwise_ref"));
  }, [isSignedIn]);


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
      window.dispatchEvent(new Event("gamification-update"));
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
      formData.append("provider", aiProvider);
      formData.append("marketplace", marketplace);
      if (priceSegment) formData.append("priceSegment", priceSegment);
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
      window.dispatchEvent(new Event("gamification-update"));
      if (typeof data.remainingCredits === "number") {
        window.dispatchEvent(new CustomEvent("credits-update", { detail: { credits: data.remainingCredits } }));
      }
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
  const currentCount = pagination.total || listings.length;
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
                  <p className="mt-3 font-medium text-red-600">Error al procesar</p>
                  {selectedListing.errorMessage && (
                    <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">{selectedListing.errorMessage}</p>
                  )}
                </div>
              )}

              {selectedListing.status === "COMPLETED" && (
                <div className="space-y-5">
                  {/* Health score + rating */}
                  <div className="flex items-center justify-between">
                    {(() => {
                      const score = calcHealthScore(selectedListing);
                      const { label, color } = getHealthLabel(score);
                      return (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Listing Health Score:</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
                            {score}/100 · {label}
                          </span>
                        </div>
                      );
                    })()}
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400 mr-1">Valorar:</span>
                      <button
                        onClick={() => handleRate(selectedListing.id, selectedListing.userRating === 1 ? null : 1)}
                        className={`p-1.5 rounded-lg text-base transition-colors ${
                          selectedListing.userRating === 1
                            ? "bg-green-100 text-green-700"
                            : "text-gray-400 hover:text-green-600 hover:bg-green-50"
                        }`}
                        title="Buen resultado"
                      >
                        👍
                      </button>
                      <button
                        onClick={() => handleRate(selectedListing.id, selectedListing.userRating === -1 ? null : -1)}
                        className={`p-1.5 rounded-lg text-base transition-colors ${
                          selectedListing.userRating === -1
                            ? "bg-red-100 text-red-700"
                            : "text-gray-400 hover:text-red-600 hover:bg-red-50"
                        }`}
                        title="Mal resultado"
                      >
                        👎
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Título A (activo)</label>
                    <input
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      maxLength={200}
                    />
                    <p className="text-xs text-gray-400 mt-1">{editTitle.length}/200 caracteres</p>
                    {selectedListing.generatedTitleB && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-1">Variante B (estrategia opuesta — clic para usar)</p>
                        <div
                          className="w-full border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 bg-gray-50 cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors"
                          onClick={() => setEditTitle(selectedListing.generatedTitleB!)}
                          title="Clic para usar la variante B como título activo"
                        >
                          {selectedListing.generatedTitleB}
                        </div>
                      </div>
                    )}
                    {selectedListing.primaryKeyword && (
                      <p className="text-xs text-gray-400 mt-1">
                        Keyword principal: <span className="font-medium text-gray-600">{selectedListing.primaryKeyword}</span>
                      </p>
                    )}
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
            <CreditsPopover />
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

        {/* Gamification strip */}
        <GamificationWidget compact />

        {/* Agent Mode banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🤖</span>
            <div>
              <p className="text-white font-semibold text-sm">
                ¿Sabías que puedes mejorar tus descripciones con IA?
              </p>
              <p className="text-blue-200 text-xs mt-0.5">
                Selecciona un producto completado y prueba el Agent Mode al instante.
              </p>
            </div>
          </div>
          <a
            href="/agent"
            className="shrink-0 px-4 py-2 bg-white text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-50 hover:scale-105 transition-all whitespace-nowrap"
          >
            Probar Agent Mode →
          </a>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-lg border p-3 text-center hover:shadow-lg transition-shadow">
            <p className="text-lg font-bold text-gray-900">{currentCount}</p>
            <p className="text-xs text-gray-500">Total productos</p>
          </div>
          <div className="bg-white rounded-lg border p-3 text-center hover:shadow-lg transition-shadow">
            <p className="text-lg font-bold text-green-600">{completedCount}</p>
            <p className="text-xs text-gray-500">Completados</p>
          </div>
          <div className="bg-white rounded-lg border p-3 text-center hover:shadow-lg transition-shadow">
            <p className="text-lg font-bold text-yellow-600">{pendingOrProcessingCount}</p>
            <p className="text-xs text-gray-500">Pendientes</p>
          </div>
          <div className="bg-white rounded-lg border p-3 text-center hover:shadow-lg transition-shadow">
            <p className="text-lg font-bold text-red-600">{failedCount}</p>
            <p className="text-xs text-gray-500">Fallidos</p>
          </div>
        </div>

        {/* Plan limit bar removed — now using credits system */}
        <div className="hidden">
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 hover:scale-105 transition-all disabled:bg-blue-400"
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
                seo: "SEO + GEO: optimizado para buscadores tradicionales (Google) y motores de búsqueda de IA (ChatGPT, Perplexity, Gemini). Incluye palabras clave estratégicas y estructura semántica que los modelos de IA entienden mejor.",
              };
              return (
                <div key={mode} className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedMode(mode)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105 ${
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

        {/* Marketplace selector */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <label className="text-sm font-medium text-gray-700">Marketplace destino</label>
            <InfoTooltip content="El prompt se adapta al estilo y estructura de cada plataforma. Amazon prioriza keywords; Etsy prioriza autenticidad; Shopify prioriza lifestyle." />
          </div>
          <div className="flex gap-2 flex-wrap">
            {([
              { id: "general", label: "🌐 General" },
              { id: "amazon", label: "📦 Amazon" },
              { id: "etsy", label: "🌿 Etsy" },
              { id: "shopify", label: "🛒 Shopify" },
            ] as const).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setMarketplace(id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105 ${
                  marketplace === id
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Price segment selector */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <label className="text-sm font-medium text-gray-700">Segmento de precio</label>
            <InfoTooltip content="Economy: práctico y directo. Mid: calidad-precio equilibrado. Premium: aspiracional y sensorial. Ajusta el tono del copy al rango de precio." />
          </div>
          <div className="flex gap-2 flex-wrap">
            {([
              { id: "", label: "Sin especificar" },
              { id: "economy", label: "💰 Economy" },
              { id: "mid", label: "⚖️ Mid" },
              { id: "premium", label: "💎 Premium" },
            ] as const).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setPriceSegment(id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105 ${
                  priceSegment === id
                    ? "bg-amber-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* AI provider is managed automatically (Gemini primary, Groq fallback) */}
        {false && (
          <div>
          </div>
        )}

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

        {/* Listings table */}
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
                    <th className="px-6 py-4 text-left font-medium text-gray-700">Producto</th>
                    <th className="px-6 py-4 text-left font-medium text-gray-700">Estado</th>
                    <th className="px-6 py-4 text-left font-medium text-gray-700">Título generado</th>
                    <th className="px-6 py-4 text-left font-medium text-gray-700">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {listings.map((listing) => (
                    <tr
                      key={listing.id}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 max-w-[200px]">
                        <button
                          onClick={(e) => { e.stopPropagation(); openModal(listing); }}
                          className="font-medium text-gray-900 hover:text-blue-600 text-left truncate w-full transition-colors"
                        >
                          {listing.productName}
                        </button>
                        {listing.status === "COMPLETED" && (() => {
                          const score = calcHealthScore(listing);
                          const { label, color } = getHealthLabel(score);
                          return (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium mt-0.5 ${color}`}>
                              {score} · {label}
                            </span>
                          );
                        })()}
                        {listing.userRating === 1 && <span className="ml-1 text-xs">👍</span>}
                        {listing.userRating === -1 && <span className="ml-1 text-xs">👎</span>}
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(listing.status)}</td>
                      <td className="px-6 py-4 text-gray-500 max-w-[300px] truncate">
                        {listing.generatedTitle || "—"}
                      </td>
                      <td className="px-6 py-4">
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

          {/* Pagination controls */}
          {pagination.totalPages > 1 && (
            <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Página {pagination.page} de {pagination.totalPages} ({pagination.total} productos)
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => fetchListings(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1.5 text-xs border rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors"
                >
                  ← Anterior
                </button>
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(pagination.page - 2, pagination.totalPages - 4));
                  const pg = start + i;
                  return (
                    <button
                      key={pg}
                      onClick={() => fetchListings(pg)}
                      className={`w-8 h-8 text-xs rounded-lg transition-colors ${
                        pg === pagination.page
                          ? "bg-blue-600 text-white"
                          : "hover:bg-gray-100 text-gray-700"
                      }`}
                    >
                      {pg}
                    </button>
                  );
                })}
                <button
                  onClick={() => fetchListings(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-3 py-1.5 text-xs border rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors"
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </>
  );
}
