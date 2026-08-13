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

  useEffect(() => {
    fetch("/api/listings/dashboard?limit=100")
      .then((r) => r.json())
      .then((data) => setListings(data.listings ?? []))
      .catch(() => {})
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
      ) : (
        <AudioFeatureBanner listings={completed} variant="inline" />
      )}
    </div>
  );
}
