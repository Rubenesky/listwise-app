"use client";

import { useEffect, useState } from "react";
import { Bot, Search, ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import AgentChat from "@/components/AgentChat";
import CreditsPopover from "@/components/CreditsPopover";

interface Listing {
  id: string;
  productName: string;
  category: string | null;
  status: string;
}

interface NextSuggestion {
  listing: Listing;
}

const PROMPT_TEMPLATES = [
  { emoji: "🎯", label: "Keywords SEO", prompt: "Añade las keywords SEO más relevantes al título y bullets de este producto." },
  { emoji: "✂️", label: "Acortar", prompt: "Acorta la descripción a 3 frases directas sin perder los beneficios clave." },
  { emoji: "⚡", label: "Tono juvenil", prompt: "Reescribe el copy en un tono juvenil, dinámico y cercano." },
  { emoji: "💼", label: "Tono formal", prompt: "Adapta el copy a un tono profesional y formal para empresas." },
  { emoji: "💡", label: "5 bullets", prompt: "Genera exactamente 5 bullet points con los beneficios principales del producto." },
  { emoji: "🌍", label: "Versión inglés", prompt: "Traduce y adapta el título y descripción al inglés optimizado para Amazon US." },
];

export default function AgentPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [updatedIds, setUpdatedIds] = useState<Set<string>>(new Set());
  const [loadingListings, setLoadingListings] = useState(true);
  const [search, setSearch] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [nextSuggestion, setNextSuggestion] = useState<NextSuggestion | null>(null);
  const [prefillMessage, setPrefillMessage] = useState<string | undefined>(undefined);
  const [templateKey, setTemplateKey] = useState(0);

  const filtered = listings.filter((l) =>
    l.productName.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectListing = (listing: Listing) => {
    setSelectedListing(listing);
    setMobileView("chat");
    setNextSuggestion(null);
  };

  const applyTemplate = (prompt: string) => {
    setPrefillMessage(prompt);
    setTemplateKey((k) => k + 1);
    if (!selectedListing) {
      // No listing yet — message will be applied when listing is selected
      return;
    }
    setMobileView("chat");
  };

  const handleApplyChanges = (_changes?: {
    title?: string | null;
    bullets?: string[] | null;
    description?: string | null;
  }) => {
    void _changes;
    if (!selectedListing) return;

    setUpdatedIds((prev) => new Set(prev).add(selectedListing.id));
    setTimeout(() => {
      setUpdatedIds((prev) => {
        const next = new Set(prev);
        next.delete(selectedListing.id);
        return next;
      });
    }, 4000);

    // Suggest the next listing in the filtered list
    const currentIdx = filtered.findIndex((l) => l.id === selectedListing.id);
    const candidates = [...filtered.slice(currentIdx + 1), ...filtered.slice(0, currentIdx)];
    const next = candidates.find((l) => l.id !== selectedListing.id);
    if (next) {
      setNextSuggestion({ listing: next });
      setTimeout(() => setNextSuggestion(null), 9000);
    }
  };

  useEffect(() => {
    fetch("/api/listings/dashboard?page=1&limit=100")
      .then((r) => r.json())
      .then((d) => {
        const completed = (d.listings ?? []).filter((l: Listing) => l.status === "COMPLETED");
        setListings(completed);

        // Read competitor prefill from localStorage
        try {
          const raw = localStorage.getItem("agent_prefill");
          if (raw) {
            const { listingId, message } = JSON.parse(raw) as { listingId?: string; message?: string };
            localStorage.removeItem("agent_prefill");
            if (message) setPrefillMessage(message);
            if (listingId) {
              const target = completed.find((l: Listing) => l.id === listingId);
              if (target) {
                setSelectedListing(target);
                setMobileView("chat");
              }
            }
          }
        } catch {
          // ignore malformed localStorage
        }
      })
      .catch(() => {})
      .finally(() => setLoadingListings(false));
  }, []);

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-8rem)]">
      {/* Header strip */}
      <div className="flex items-center justify-between gap-4 flex-wrap shrink-0">
        <div className="flex items-center gap-3">
          {mobileView === "chat" && selectedListing && (
            <button
              onClick={() => setMobileView("list")}
              className="md:hidden flex items-center gap-1 text-blue-600 text-sm font-medium"
              aria-label="Volver a productos"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">
              {mobileView === "chat" && selectedListing ? (
                <>
                  <span className="md:hidden truncate max-w-[180px] inline-block">{selectedListing.productName}</span>
                  <span className="hidden md:inline">Agente de Copywriting</span>
                </>
              ) : (
                "Agente de Copywriting"
              )}
            </h1>
            <p className="text-xs text-gray-500 hidden md:block">Selecciona un producto y empieza a conversar</p>
          </div>
        </div>
        <CreditsPopover />
      </div>

      {/* Main content: product list + chat */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: product selector — hidden on mobile when chat is active */}
        <div className={`
          flex flex-col border border-gray-200 bg-white rounded-xl overflow-hidden
          ${mobileView === "chat" ? "hidden md:flex md:w-64 md:shrink-0" : "flex-1 md:flex md:w-64 md:flex-none md:shrink-0"}
        `}>
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
                      onClick={() => handleSelectListing(listing)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-colors ${
                        selectedListing?.id === listing.id
                          ? "bg-blue-600 text-white"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-medium truncate">{listing.productName}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          {updatedIds.has(listing.id) && (
                            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-green-400 text-white animate-pulse">
                              ✓
                            </span>
                          )}
                          <ChevronRight className={`h-3 w-3 ${selectedListing?.id === listing.id ? "text-blue-200" : "text-gray-300"}`} />
                        </div>
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
              <p className="text-xs text-gray-400 text-center">
                {listings.length} producto{listings.length !== 1 ? "s" : ""} completado{listings.length !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </div>

        {/* Right: chat — hidden on mobile when list is active */}
        <div className={`
          flex flex-col flex-1 min-w-0
          ${mobileView === "list" ? "hidden md:flex" : "flex"}
        `}>
          {/* Cross-product retention banner */}
          {nextSuggestion && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 mb-2 bg-green-50 border border-green-200 rounded-xl text-xs shrink-0">
              <span className="text-green-800 truncate">
                ✓ Guardado. ¿Continuar con <strong>{nextSuggestion.listing.productName}</strong>?
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleSelectListing(nextSuggestion.listing)}
                  className="text-green-700 font-semibold hover:text-green-900 transition-colors whitespace-nowrap"
                >
                  Sí →
                </button>
                <button
                  onClick={() => setNextSuggestion(null)}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="Ignorar"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {selectedListing ? (
            <>
              <div className="flex items-center gap-2 flex-wrap shrink-0 mb-2">
                <span className="text-xs text-gray-400 shrink-0">Plantillas:</span>
                {PROMPT_TEMPLATES.map((t) => (
                  <button
                    key={t.label}
                    onClick={() => applyTemplate(t.prompt)}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 bg-white border border-gray-200 rounded-full text-gray-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
              <AgentChat
                key={`${selectedListing.id}-${templateKey}`}
                listingId={selectedListing.id}
                productName={selectedListing.productName}
                inline
                initialMessage={prefillMessage}
                onApplyChanges={handleApplyChanges}
              />
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-white border border-gray-200 rounded-xl text-center p-8">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                <Bot className="w-9 h-9 text-blue-400" />
              </div>
              <h2 className="text-base font-semibold text-gray-800 mb-1">Selecciona un producto</h2>
              <p className="text-sm text-gray-500 max-w-xs">
                Elige uno de tus productos y usa una plantilla para empezar al instante.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2 max-w-sm">
                {PROMPT_TEMPLATES.map((t) => (
                  <button
                    key={t.label}
                    onClick={() => applyTemplate(t.prompt)}
                    className="flex items-center gap-2 bg-gray-50 hover:bg-blue-50 hover:border-blue-200 rounded-lg px-3 py-2 border border-gray-100 text-xs text-gray-700 text-left transition-colors"
                  >
                    <span className="text-base shrink-0">{t.emoji}</span>
                    <span className="font-medium">{t.label}</span>
                  </button>
                ))}
              </div>
              {prefillMessage && (
                <p className="mt-4 text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
                  Plantilla lista — selecciona un producto para aplicarla
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
