"use client";

import { useEffect, useState } from "react";
import AudioFeatureBanner from "@/components/AudioFeatureBanner";

interface DashboardListing {
  id: string;
  productName: string;
  generatedTitle: string | null;
  status: string;
}

export default function AudioComercialPage() {
  const [listings, setListings] = useState<DashboardListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetch("/api/listings/dashboard?limit=100")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load listings");
        return r.json();
      })
      .then((data) => setListings(data.listings ?? []))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  const completed = listings
    .filter((l) => l.status === "COMPLETED")
    .map((l) => ({ id: l.id, productName: l.productName, generatedTitle: l.generatedTitle }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">🔊 Audio Comercial</h1>
        <p className="mt-1 text-sm text-gray-600">
          Convierte cualquier producto completado en un audio comercial listo para compartir.
        </p>
      </div>
      {loading ? (
        <p className="text-sm text-gray-500">Cargando productos...</p>
      ) : loadError ? (
        <p className="text-sm text-red-600">
          No se pudieron cargar tus productos. Recarga la página para intentarlo de nuevo.
        </p>
      ) : (
        <AudioFeatureBanner listings={completed} variant="inline" />
      )}
    </div>
  );
}
