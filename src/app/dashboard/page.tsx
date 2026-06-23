"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState, useCallback, useRef } from "react";
import { useUserPlan } from "@/lib/hooks/useUserPlan";
import { PLAN_LIMITS } from "@/lib/constants";

type ListingStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

interface ListingRow {
  id: string;
  productName: string;
  status: ListingStatus;
  generatedTitle: string | null;
  generatedBullets: string[] | null;
  generatedDescription: string | null;
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

  const fetchListings = useCallback(async () => {
    try {
      const res = await fetch("/api/listings/dashboard");
      if (!res.ok) return;
      const data = await res.json();
      setListings(data);
    } catch (error) {
      console.error("Error fetching listings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSignedIn) {
      fetchListings();
    }
  }, [isSignedIn, fetchListings]);

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
    } catch (error) {
      alert("Error al subir el archivo. Inténtalo de nuevo.");
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (status: ListingStatus) => {
    const styles = {
      PENDING: "bg-yellow-100 text-yellow-800",
      PROCESSING: "bg-blue-100 text-blue-800",
      COMPLETED: "bg-green-100 text-green-800",
      FAILED: "bg-red-100 text-red-800",
    };
    const labels = {
      PENDING: "Pendiente",
      PROCESSING: "Procesando",
      COMPLETED: "Completado",
      FAILED: "Fallido",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
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

  return (
    <div className="space-y-6">
      {/* Header con plan */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
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

      {/* Límite de productos */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-gray-600">
            Productos utilizados: <span className="font-semibold text-gray-900">{currentCount}</span>
            {planLimit !== Infinity && (
              <> de <span className="font-semibold text-gray-900">{planLimit}</span></>
            )}
          </span>
          {planLimit !== Infinity && (
            <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all"
                style={{
                  width: `${Math.min((currentCount / planLimit) * 100, 100)}%`,
                }}
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

      {/* Upload Area */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
        <div className="flex flex-col items-center gap-3">
          {file ? (
            <>
              <p className="font-medium text-gray-900">{file.name}</p>
              <p className="text-sm text-gray-500">
                {(file.size / 1024).toFixed(1)} KB
              </p>
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
              <p className="text-sm text-gray-500">
                o haz clic para seleccionar un archivo
              </p>
              <p className="text-xs text-gray-400">
                Columna requerida: <code className="bg-gray-100 px-1 rounded">productName</code>
                . Opciones: <code className="bg-gray-100 px-1 rounded">category</code>,{" "}
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

      {/* Listings Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex justify-between items-center">
          <h2 className="font-semibold text-gray-900">Tus listados</h2>
          <span className="text-xs text-gray-500">
            {listings.length} productos
          </span>
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
            <table className="w-full text-sm">
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
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                      {listing.productName}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(listing.status)}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[300px] truncate">
                      {listing.generatedTitle || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        disabled={listing.status !== "COMPLETED"}
                        className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                      >
                        Editar
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