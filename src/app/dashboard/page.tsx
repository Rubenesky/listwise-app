"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useUserPlan } from "@/lib/hooks/useUserPlan";
import { PLAN_LIMITS } from "@/lib/constants";
import VoiceProfileManager from "@/components/VoiceProfileManager";
import InfoTooltip from "@/components/InfoTooltip";
import GamificationWidget from "@/components/GamificationWidget";
import CreditsPopover from "@/components/CreditsPopover";
import OnboardingModal from "@/components/OnboardingModal";
import PhotoUploader from "@/components/PhotoUploader";

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
  const pollDelayRef = useRef(4000);

  // Modal state
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const selectedListing = listings.find((l) => l.id === selectedListingId) ?? null;
  const [editTitle, setEditTitle] = useState("");
  const [editBullets, setEditBullets] = useState<string[]>([]);
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [checklistDismissed, setChecklistDismissed] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("listwise_checklist_dismissed") === "true";
    return false;
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ListingStatus>("all");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortByHealth, setSortByHealth] = useState<"none" | "asc" | "desc">("none");
  const [dragActive, setDragActive] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem("lw_onboarding_v1_done");
  });
  const [demoLoading, setDemoLoading] = useState(false);

  const dismissChecklist = () => {
    localStorage.setItem("listwise_checklist_dismissed", "true");
    setChecklistDismissed(true);
  };

  const copyToClipboard = async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/listings/${id}`, { method: "DELETE" });
      setListings((prev) => prev.filter((l) => l.id !== id));
      if (selectedListingId === id) closeModal();
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAllFailed = async () => {
    if (!confirm(`¿Eliminar todos los listings fallidos? Esta acción no se puede deshacer.`)) return;
    setBulkWorking(true);
    try {
      await fetch("/api/listings/bulk", { method: "DELETE" });
      setListings((prev) => prev.filter((l) => l.status !== "FAILED"));
    } finally {
      setBulkWorking(false);
    }
  };

  const handleRetryFailed = async () => {
    setBulkWorking(true);
    try {
      const res = await fetch("/api/listings/bulk", { method: "POST" });
      const data = await res.json();
      if (data.retrying > 0) {
        setBatchTotal(data.retrying);
        setIsProcessing(true);
        await fetchListings();
      }
    } finally {
      setBulkWorking(false);
    }
  };

  const handleOpenInAgent = (listing: ListingRow) => {
    localStorage.setItem("agent_prefill", JSON.stringify({ listingId: listing.id }));
    window.location.href = "/agent";
  };

  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
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

  // Filtered + sorted listings (memoized to avoid O(n log n) health score calls on every render)
  const filteredListings = useMemo(() => {
    const withScore = listings.map((l) => ({ ...l, _score: calcHealthScore(l) }));
    return withScore
      .filter((l) => {
        const matchesSearch = !searchQuery || l.productName.toLowerCase().includes(searchQuery.toLowerCase()) || (l.generatedTitle ?? "").toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === "all" || l.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (sortByHealth === "none") return 0;
        return sortByHealth === "asc" ? a._score - b._score : b._score - a._score;
      });
  }, [listings, searchQuery, statusFilter, sortByHealth]);

  // Progress bar
  const processedInBatch = Math.max(0, batchTotal - pendingOrProcessingCount);
  const progressPct = batchTotal > 0 ? Math.round((processedInBatch / batchTotal) * 100) : 0;

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;
    pollDelayRef.current = 4000;

    const tick = async () => {
      try {
        const res = await fetch(`/api/listings/dashboard?page=${currentPageRef.current}&limit=20`);
        if (!res.ok) {
          pollDelayRef.current = Math.min(pollDelayRef.current * 2, 30000);
          intervalRef.current = setTimeout(tick, pollDelayRef.current);
          return;
        }
        const json = await res.json();
        const data: ListingRow[] = json.listings ?? [];
        setListings(data);
        if (json.pagination) setPagination(json.pagination);
        const hasActive = data.some(
          (l) => l.status === "PENDING" || l.status === "PROCESSING"
        );
        if (!hasActive) {
          intervalRef.current = null;
          stopPolling();
          setIsProcessing(false);
        } else {
          pollDelayRef.current = Math.min(pollDelayRef.current * 2, 30000);
          intervalRef.current = setTimeout(tick, pollDelayRef.current);
        }
      } catch {
        pollDelayRef.current = Math.min(pollDelayRef.current * 2, 30000);
        intervalRef.current = setTimeout(tick, pollDelayRef.current);
      }
    };

    intervalRef.current = setTimeout(tick, pollDelayRef.current);
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
    if (isSignedIn) {
      fetchListings();
      fetch("/api/user/credits").then((r) => r.json()).then((d) => setCredits(d.credits ?? null)).catch((e) => console.warn("[dashboard] Error cargando créditos:", e));
    }
  }, [isSignedIn, fetchListings]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ credits: number }>).detail;
      if (typeof detail?.credits === "number") setCredits(detail.credits);
    };
    window.addEventListener("credits-update", handler);
    return () => window.removeEventListener("credits-update", handler);
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  useEffect(() => {
    localStorage.setItem("listwise_generation_mode", selectedMode);
    localStorage.setItem("listwise_marketplace", marketplace);
    localStorage.setItem("listwise_price_segment", priceSegment);
  }, [selectedMode, marketplace, priceSegment]);

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

  const handleDemoUpload = async () => {
    setDemoLoading(true);
    setUploadErrors([]);
    try {
      const res = await fetch("/demo.csv");
      const blob = await res.blob();
      const demoFile = new File([blob], "demo.csv", { type: "text/csv" });
      const formData = new FormData();
      formData.append("file", demoFile);
      formData.append("mode", selectedMode);
      formData.append("provider", aiProvider);
      formData.append("marketplace", marketplace);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await uploadRes.json();
      if (!uploadRes.ok) {
        setUploadErrors([data.error || "Error al cargar el demo"]);
        return;
      }
      setBatchTotal(data.count || 0);
      setIsProcessing(true);
      startPolling();
      window.dispatchEvent(new Event("gamification-update"));
    } catch {
      setUploadErrors(["Error al cargar el demo. Inténtalo de nuevo."]);
    } finally {
      setDemoLoading(false);
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
  const planLimit = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.free;
  const currentCount = pagination.total || listings.length;
  const hasPendingOrProcessing = pendingOrProcessingCount > 0;

  return (
    <>

      {/* Detail / Edit Modal */}
      {selectedListing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
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
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-gray-700">Título A (activo)</label>
                      <button
                        onClick={() => copyToClipboard(editTitle, "modal-title")}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors px-2 py-0.5 rounded hover:bg-blue-50"
                      >
                        {copiedField === "modal-title" ? (
                          <><svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg> Copiado</>
                        ) : (
                          <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> Copiar</>
                        )}
                      </button>
                    </div>
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
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">Bullet points ({editBullets.length})</label>
                      <button
                        onClick={() => copyToClipboard(editBullets.map((b, i) => `${i + 1}. ${b}`).join("\n"), "modal-bullets")}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors px-2 py-0.5 rounded hover:bg-blue-50"
                      >
                        {copiedField === "modal-bullets" ? (
                          <><svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg> Copiado</>
                        ) : (
                          <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> Copiar todos</>
                        )}
                      </button>
                    </div>
                    <div className="space-y-2">
                      {editBullets.map((bullet, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="mt-2.5 text-xs text-gray-400 w-5 shrink-0 text-right">{i + 1}.</span>
                          <textarea
                            className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                            rows={2}
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
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-gray-700">Descripción</label>
                      <button
                        onClick={() => copyToClipboard(editDescription, "modal-desc")}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors px-2 py-0.5 rounded hover:bg-blue-50"
                      >
                        {copiedField === "modal-desc" ? (
                          <><svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg> Copiado</>
                        ) : (
                          <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> Copiar</>
                        )}
                      </button>
                    </div>
                    <textarea
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      rows={9}
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

      {showOnboarding && <OnboardingModal onDismiss={() => setShowOnboarding(false)} />}

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

        {/* Low credits banner */}
        {credits !== null && credits < 50 && (
          <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm ${
            credits === 0
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-amber-50 border-amber-200 text-amber-800"
          }`}>
            <div className="flex items-center gap-2">
              <span>{credits === 0 ? "🚫" : "⚠️"}</span>
              <span>
                {credits === 0
                  ? "Sin créditos — no puedes generar nuevos listings ni usar el Agente."
                  : `Te quedan solo ${credits} crédito${credits === 1 ? "" : "s"}.`}
              </span>
            </div>
            <a
              href="/pricing"
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                credits === 0
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-amber-600 text-white hover:bg-amber-700"
              }`}
            >
              {plan === "free" ? "Mejorar plan →" : "Comprar créditos →"}
            </a>
          </div>
        )}

        {/* Activation checklist — solo para usuarios sin completados */}
        {completedCount === 0 && !checklistDismissed && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-blue-900 text-sm">🚀 Primeros pasos — empieza en 3 minutos</p>
              <button onClick={dismissChecklist} className="text-blue-300 hover:text-blue-500 transition-colors text-lg leading-none">✕</button>
            </div>
            <div className="space-y-2">
              {[
                { label: "Crear tu cuenta", done: true, href: null },
                { label: "Subir tu primer CSV y generar un listing", done: currentCount > 0, href: null },
                { label: "Refinar con el Agente de Copywriting", done: false, href: "/agent" },
              ].map(({ label, done, href }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-colors ${
                    done ? "bg-green-500 text-white" : "bg-white border-2 border-blue-300 text-blue-500"
                  }`}>
                    {done ? "✓" : "→"}
                  </span>
                  {href ? (
                    <a href={href} className={`text-sm ${done ? "line-through text-gray-400" : "text-blue-800 hover:text-blue-600 hover:underline"}`}>{label}</a>
                  ) : (
                    <span className={`text-sm ${done ? "line-through text-gray-400" : "text-blue-800"}`}>{label}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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
        <div
          className={`upload-area border-2 border-dashed rounded-lg p-5 text-center transition-colors ${dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-500"}`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            const dropped = e.dataTransfer.files[0];
            if (dropped?.name.toLowerCase().endsWith(".csv")) {
              setFile(dropped);
            } else if (dropped) {
              setUploadErrors(["Solo se aceptan archivos CSV."]);
            }
          }}
        >
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

        {/* Photo upload alternative */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 shrink-0">o sube una foto</span>
          <PhotoUploader onListingCreated={fetchListings} />
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
                {processedInBatch < batchTotal
                  ? `Generando producto ${processedInBatch + 1} de ${batchTotal}...`
                  : "Finalizando..."}
              </span>
              <span className="font-medium text-blue-700">{progressPct}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-400">Recibirás un email cuando todos estén listos.</p>
          </div>
        )}

        {/* Listings table */}
        <div className="listings-table border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <div className="flex justify-between items-center mb-2.5">
              <div className="flex items-center gap-3">
                <h2 className="font-semibold text-gray-900">Tus listados</h2>
                {hasPendingOrProcessing && (
                  <span className="flex items-center gap-1.5 text-xs text-blue-600">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                    Procesando...
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">
                  {filteredListings.length !== listings.length
                    ? `${filteredListings.length} de ${listings.length}`
                    : `${listings.length} productos`}
                </span>
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
            {listings.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[160px] max-w-xs">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Buscar producto..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="flex gap-1">
                  {(["all", "COMPLETED", "FAILED"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setStatusFilter(f)}
                      className={`px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                        statusFilter === f
                          ? f === "all" ? "bg-gray-700 text-white" : f === "COMPLETED" ? "bg-green-600 text-white" : "bg-red-500 text-white"
                          : "bg-white border text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {f === "all" ? "Todos" : f === "COMPLETED" ? "Completados" : "Fallidos"}
                    </button>
                  ))}
                </div>
                {failedCount > 0 && (
                  <div className="flex gap-1.5 ml-1">
                    <button
                      onClick={handleRetryFailed}
                      disabled={bulkWorking}
                      className="px-2.5 py-1.5 text-xs rounded-lg font-medium bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors"
                    >
                      {bulkWorking ? "..." : `↺ Reintentar (${failedCount})`}
                    </button>
                    <button
                      onClick={handleDeleteAllFailed}
                      disabled={bulkWorking}
                      className="px-2.5 py-1.5 text-xs rounded-lg font-medium bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
                    >
                      {bulkWorking ? "..." : `🗑 Eliminar fallidos`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : listings.length === 0 ? (
            <div className="py-10 px-6 text-center">
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1.5">Sube tu primer CSV para empezar</h3>
              <p className="text-sm text-gray-500 mb-5 max-w-xs mx-auto">
                Añade los nombres de tus productos y la IA genera título, bullets y descripción en menos de 60 segundos.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center mb-4">
                <button
                  onClick={handleDemoUpload}
                  disabled={demoLoading}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 hover:scale-105 transition-all disabled:bg-blue-400 disabled:scale-100"
                >
                  {demoLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Cargando demo...
                    </>
                  ) : (
                    "⚡ Probar con CSV de demo (1 clic)"
                  )}
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-center mb-6">
                <a
                  href="/api/template/csv"
                  download="plantilla_listwise.csv"
                  className="inline-flex items-center gap-1.5 px-4 py-2 border border-blue-300 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors"
                >
                  ⬇ Descargar plantilla CSV
                </a>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  📤 Subir mi propio CSV
                </button>
              </div>
              <div className="max-w-sm mx-auto text-left bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Ejemplo de resultado generado</p>
                <p className="text-xs font-bold text-gray-800 mb-2 leading-snug">
                  Zapatillas Running Pro X200 | Suela Amortiguadora | Transpirable | Hombre y Mujer
                </p>
                <ul className="space-y-1 mb-2">
                  {[
                    "AMORTIGUACIÓN TOTAL: Tecnología gel que absorbe cada impacto y protege tus articulaciones",
                    "TRANSPIRABILIDAD: Malla 3D que mantiene el pie fresco incluso en los entrenamientos más duros",
                    "AGARRE PERFECTO: Suela de goma con taco multidireccional para cualquier superficie",
                  ].map((b) => (
                    <li key={b} className="text-xs text-gray-600 flex items-start gap-1">
                      <span className="text-blue-400 shrink-0">•</span> {b}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-gray-400 italic">&ldquo;Imagina cruzar la línea de meta sintiéndote más ligero que nunca...&rdquo;</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-left font-medium text-gray-700 w-8"></th>
                    <th className="px-6 py-4 text-left font-medium text-gray-700">Producto</th>
                    <th className="px-6 py-4 text-left font-medium text-gray-700">Estado</th>
                    <th className="px-6 py-4 text-left font-medium text-gray-700">
                      <button
                        onClick={() => setSortByHealth(s => s === "none" ? "desc" : s === "desc" ? "asc" : "none")}
                        className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                        title="Ordenar por Health Score"
                      >
                        Health
                        <span className="text-gray-400">
                          {sortByHealth === "desc" ? "↓" : sortByHealth === "asc" ? "↑" : "↕"}
                        </span>
                      </button>
                    </th>
                    <th className="px-6 py-4 text-left font-medium text-gray-700">Título generado</th>
                    <th className="px-6 py-4 text-left font-medium text-gray-700">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredListings.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-400">
                        No se encontraron productos con ese filtro.
                      </td>
                    </tr>
                  )}
                  {filteredListings.map((listing) => {
                    const score = listing._score;
                    const { label, color } = getHealthLabel(score);
                    const isExpanded = expandedRows.has(listing.id);
                    return (
                      <>
                        <tr key={listing.id} className="hover:bg-gray-50">
                          {/* Expand toggle */}
                          <td className="pl-4 py-4 w-8">
                            {listing.status === "COMPLETED" && listing.generatedBullets?.length ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleExpand(listing.id); }}
                                className="text-gray-400 hover:text-gray-600 transition-transform"
                                style={{ transform: isExpanded ? "rotate(90deg)" : undefined }}
                                title={isExpanded ? "Colapsar" : "Ver bullets"}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                            ) : null}
                          </td>
                          <td className="px-4 py-4 max-w-[180px]">
                            <button
                              onClick={(e) => { e.stopPropagation(); openModal(listing); }}
                              className="font-medium text-gray-900 hover:text-blue-600 text-left truncate w-full transition-colors block"
                            >
                              {listing.productName}
                            </button>
                            {listing.userRating === 1 && <span className="text-xs">👍</span>}
                            {listing.userRating === -1 && <span className="text-xs">👎</span>}
                          </td>
                          <td className="px-4 py-4">{getStatusBadge(listing.status)}</td>
                          <td className="px-4 py-4">
                            {listing.status === "COMPLETED" && (
                              score < 80 ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleOpenInAgent(listing); }}
                                  title="Mejorar con el Agente IA"
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${color} hover:ring-1 hover:ring-indigo-400 transition-all`}
                                >
                                  {score} · {label} ✨
                                </button>
                              ) : (
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${color}`}>
                                  {score} · {label}
                                </span>
                              )
                            )}
                          </td>
                          <td className="px-4 py-4 text-gray-500 max-w-[260px]">
                            <div className="flex items-start gap-1.5">
                              <span className="truncate text-xs">{listing.generatedTitle || "—"}</span>
                              {listing.generatedTitle && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); copyToClipboard(listing.generatedTitle!, `title-${listing.id}`); }}
                                  className="shrink-0 p-1 rounded text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                                  title="Copiar título"
                                >
                                  {copiedField === `title-${listing.id}` ? (
                                    <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                  ) : (
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1 flex-wrap">
                              <button
                                onClick={(e) => { e.stopPropagation(); openModal(listing); }}
                                className="px-2.5 py-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                              >
                                {listing.status === "COMPLETED" ? "Editar" : "Ver"}
                              </button>
                              {listing.status === "COMPLETED" && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleOpenInAgent(listing); }}
                                  className="px-2.5 py-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                                  title="Mejorar con el Agente de IA"
                                >
                                  🤖 Mejorar
                                </button>
                              )}
                              {listing.status === "COMPLETED" && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleShare(listing.id); }}
                                  disabled={sharing === listing.id}
                                  className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                                  title="Compartir"
                                >
                                  {sharing === listing.id ? "..." : "🔗"}
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(listing.id); }}
                                disabled={deletingId === listing.id}
                                className="px-2 py-1 text-xs text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
                                title="Eliminar"
                              >
                                {deletingId === listing.id ? (
                                  <span className="inline-block w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && listing.generatedBullets && (
                          <tr key={`${listing.id}-expanded`} className="bg-blue-50/40 border-t-0">
                            <td colSpan={6} className="px-10 py-3">
                              <ul className="space-y-1 mb-3">
                                {listing.generatedBullets.map((b, i) => (
                                  <li key={i} className="text-xs text-gray-600 flex items-start gap-2 group">
                                    <span className="text-blue-400 shrink-0 mt-0.5">•</span>
                                    <span className="flex-1">{b}</span>
                                    <button
                                      onClick={() => copyToClipboard(b, `bullet-${listing.id}-${i}`)}
                                      className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded text-gray-300 hover:text-blue-500 transition-all"
                                      title="Copiar bullet"
                                    >
                                      {copiedField === `bullet-${listing.id}-${i}` ? (
                                        <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                      ) : (
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                      )}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                              <div className="flex gap-2 flex-wrap">
                                <button
                                  onClick={() => copyToClipboard(
                                    listing.generatedBullets!.map((b, i) => `${i + 1}. ${b}`).join("\n"),
                                    `bullets-all-${listing.id}`
                                  )}
                                  className="text-xs px-2.5 py-1 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                                >
                                  {copiedField === `bullets-all-${listing.id}` ? "✓ Copiado" : "📋 Copiar bullets"}
                                </button>
                                {listing.generatedTitle && listing.generatedDescription && (
                                  <button
                                    onClick={() => copyToClipboard(
                                      `TÍTULO:\n${listing.generatedTitle}\n\nBULLETS:\n${listing.generatedBullets!.map((b, i) => `${i + 1}. ${b}`).join("\n")}\n\nDESCRIPCIÓN:\n${listing.generatedDescription}`,
                                      `all-${listing.id}`
                                    )}
                                    className="text-xs px-2.5 py-1 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                                  >
                                    {copiedField === `all-${listing.id}` ? "✓ Copiado" : "📄 Copiar listing completo"}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
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
