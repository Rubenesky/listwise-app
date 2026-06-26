"use client";

import { useEffect, useState } from "react";
import { Bot, Search } from "lucide-react";
import Link from "next/link";
import AgentChat from "@/components/AgentChat";
import CreditsPopover from "@/components/CreditsPopover";

interface Listing {
  id: string;
  productName: string;
  category: string | null;
  status: string;
}

export default function AgentPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [updatedIds, setUpdatedIds] = useState<Set<string>>(new Set());
  const [loadingListings, setLoadingListings] = useState(true);
  const [search, setSearch] = useState("");

  const handleApplyChanges = () => {
    if (!selectedListing) return;
    setUpdatedIds((prev) => new Set(prev).add(selectedListing.id));
    setTimeout(() => {
      setUpdatedIds((prev) => {
        const next = new Set(prev);
        next.delete(selectedListing.id);
        return next;
      });
    }, 4000);
  };

  useEffect(() => {
    fetch("/api/listings/dashboard?page=1&limit=100")
      .then((r) => r.json())
      .then((d) => {
        const completed = (d.listings ?? []).filter((l: Listing) => l.status === "COMPLETED");
        setListings(completed);
      })
      .catch(() => {})
      .finally(() => setLoadingListings(false));
  }, []);

  const filtered = listings.filter((l) =>
    l.productName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-8rem)]">
      {/* Header strip */}
      <div className="flex items-center justify-between gap-4 flex-wrap shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Agente de Copywriting</h1>
            <p className="text-xs text-gray-500">Selecciona un producto y empieza a conversar</p>
          </div>
        </div>
        <CreditsPopover />
      </div>

      {/* Main content: product list + chat */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: product selector */}
        <div className="w-64 shrink-0 flex flex-col border border-gray-200 bg-white rounded-xl overflow-hidden">
          <div className="px-3 py-2.5 border-b border-gray-100 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar producto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingListings ? (
              <div className="p-3 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                <Bot className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-xs text-gray-500">
                  {listings.length === 0
                    ? "Aún no tienes productos completados."
                    : "Sin resultados para tu búsqueda."}
                </p>
                {listings.length === 0 && (
                  <Link href="/dashboard" className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium">
                    Ir al dashboard →
                  </Link>
                )}
              </div>
            ) : (
              <ul className="p-2 space-y-1">
                {filtered.map((listing) => (
                  <li key={listing.id}>
                    <button
                      onClick={() => setSelectedListing(listing)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-colors ${
                        selectedListing?.id === listing.id
                          ? "bg-blue-600 text-white"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-medium truncate">{listing.productName}</p>
                        {updatedIds.has(listing.id) && (
                          <span className="shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-green-400 text-white animate-pulse">
                            ✓
                          </span>
                        )}
                      </div>
                      {listing.category && (
                        <p className={`text-xs mt-0.5 truncate ${
                          selectedListing?.id === listing.id ? "text-blue-200" : "text-gray-400"
                        }`}>
                          {listing.category}
                        </p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {listings.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-100 shrink-0">
              <p className="text-xs text-gray-400 text-center">{listings.length} producto{listings.length !== 1 ? "s" : ""} completado{listings.length !== 1 ? "s" : ""}</p>
            </div>
          )}
        </div>

        {/* Right: chat */}
        <div className="flex-1 min-w-0">
          {selectedListing ? (
            <AgentChat
              key={selectedListing.id}
              listingId={selectedListing.id}
              productName={selectedListing.productName}
              inline
              onApplyChanges={handleApplyChanges}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-white border border-gray-200 rounded-xl text-center p-8">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                <Bot className="w-9 h-9 text-blue-400" />
              </div>
              <h2 className="text-base font-semibold text-gray-800 mb-1">Selecciona un producto</h2>
              <p className="text-sm text-gray-500 max-w-xs">
                Elige uno de tus productos completados de la lista para empezar a mejorar su descripción con IA.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2 max-w-xs text-xs text-gray-500">
                {["✂️ Acortar descripción", "🎯 Añadir keywords SEO", "⚡ Tono juvenil", "💼 Estilo formal"].map((ex) => (
                  <div key={ex} className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">{ex}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
