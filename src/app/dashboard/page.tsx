"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState, useCallback, useRef } from "react";
import { useUserPlan } from "@/lib/hooks/useUserPlan";
import { PLAN_LIMITS } from "@/lib/constants";

type ListingStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

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

export default function DashboardPage() {
  const { isLoaded, isSignedIn } = useUser();
  const { plan, status, loading: planLoading } = useUserPlan();
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Modal state
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const selectedListing = listings.find((l) => l.id === selectedListingId) ?? null;
  const [editTitle, setEditTitle] = useState("");
  const [editBullets, setEditBullets] = useState<string[]>([]);
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

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
        if (!hasActive) stopPolling();
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

  const openModal = (listing: ListingRow) => {
    setSelectedListingId(listing.id);
    setEditTitle(listing.generatedTitle ?? "");
    setEditBullets(listing.generatedBullets ?? []);
    setEditDescription(listing.generatedDescription ?? "");
  };

  const closeModal = () => setSelectedListingId(null);

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
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const error = await res.json();
        alert(`Error: ${error.error || "Error al subir el archivo"}`);
        return;
      }
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchListings();
    } catch {
      alert("Error al subir el archivo. Inténtalo de nuevo.");
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
  const hasPendingOrProcessing = listings.some(
    (l) => l.status === "PENDING" || l.status === "PROCESSING"
  );

  return (
    <div className="space-y-6">
      {/* Detail / Edit Modal */}
      {selectedListing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
            {/* Modal header */}
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

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 px-6 py-4">
              {(selectedListing.status === "PENDING" || selectedListing.status === "PROCESSING") && (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-3 text-gray-500">
                    {selectedListing.status === "PENDING"
                      ? "En cola — esperando procesamiento..."
                      : "Generando contenido con IA..."}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    El estado se actualizará automáticamente.
                  </p>
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
                    <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
                      {selectedListing.errorMessage}
                    </p>
                  )}
                </div>
              )}

              {selectedListing.status === "COMPLETED" && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Título optimizado
                    </label>
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
                          <span className="mt-2 text-xs text-gray-400 w-5 shrink-0 text-right">
                            {i + 1}.
                          </span>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Descripción
                    </label>
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

            {/* Modal footer */}
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-gray-600">
            Sube tu catálogo en CSV y la IA generará títulos, bullets y descripciones optimizadas.
          </p>
        </div>
        <div className="flex items-center gap-3">
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

      {/* Plan limit bar */}
      <div className="bg-white rounded-lg border p-4">
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
            <a
              href="/pricing"
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Upgrade para más productos →
            </a>
          )}
        </div>
      </div>

      {/* Upload area */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
        <div className="flex flex-col items-center gap-3">
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
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {/* Listings table */}
      <div className="border rounded-lg overflow-hidden">
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
          <span className="text-xs text-gray-500">{listings.length} productos</span>
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
                  <tr key={listing.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 max-w-[200px]">
                      <button
                        onClick={() => openModal(listing)}
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
                      <button
                        onClick={() => openModal(listing)}
                        className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        {listing.status === "COMPLETED" ? "Editar" : "Ver"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
