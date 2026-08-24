"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";

const LS_DONE = "lw_lead_v1_done";
const SS_DISMISSED = "lw_lead_v1_dismissed";

const EXCLUDED_PREFIXES = ["/dashboard", "/admin", "/sign-in", "/sign-up"];

const MARKETPLACES = ["Amazon", "Etsy", "eBay", "Shopify", "PrestaShop", "WooCommerce", "Wallapop", "Otro"];

export default function LeadMagnetPopup() {
  const { isLoaded, isSignedIn } = useUser();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [marketplace, setMarketplace] = useState("");
  const shown = useRef(false);

  const isExcluded = EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p));

  const tryShow = useCallback(() => {
    if (shown.current) return;
    try {
      if (localStorage.getItem(LS_DONE)) return;
      if (sessionStorage.getItem(SS_DISMISSED)) return;
    } catch {
      return;
    }
    shown.current = true;
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!isLoaded || isSignedIn || isExcluded) return;

    const onScroll = () => {
      const pct = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      if (pct >= 0.5) tryShow();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isLoaded, isSignedIn, isExcluded, tryShow]);

  function dismiss() {
    setVisible(false);
    try { sessionStorage.setItem(SS_DISMISSED, "1"); } catch { /* ignore */ }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || loading) return;
    setLoading(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: name || undefined,
          marketplace: marketplace || undefined,
          pageUrl: window.location.href,
          utmSource: params.get("utm_source") ?? undefined,
          utmMedium: params.get("utm_medium") ?? undefined,
          utmCampaign: params.get("utm_campaign") ?? undefined,
        }),
      });
      if (res.ok) {
        setSuccess(true);
        try { localStorage.setItem(LS_DONE, "1"); } catch { /* ignore */ }
      }
    } finally {
      setLoading(false);
    }
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[500px] overflow-hidden relative">
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 z-10 text-white/70 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10"
          aria-label="Cerrar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="bg-orange-500 px-8 pt-8 pb-6">
          <p className="text-orange-100 text-xs font-semibold uppercase tracking-widest mb-2">Recurso gratuito</p>
          <h2 className="text-white text-xl font-bold leading-tight mb-2">
            📩 La guía definitiva de descripciones
          </h2>
          <p className="text-orange-100 text-sm leading-relaxed">
            7 errores que matan tus ventas + la fórmula SEO que Amazon premia
          </p>
        </div>

        {success ? (
          <div className="px-8 py-10 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">¡Te la hemos enviado!</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Revisa tu bandeja de entrada. Si no la ves en 5 minutos, mira la carpeta de spam.
            </p>
            <button
              onClick={dismiss}
              className="mt-6 px-6 py-2.5 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors text-sm"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                maxLength={254}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Nombre <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  maxLength={100}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Marketplace <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <select
                  value={marketplace}
                  onChange={(e) => setMarketplace(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 bg-white"
                >
                  <option value="">Selecciona...</option>
                  {MARKETPLACES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-bold rounded-lg transition-colors disabled:opacity-60 text-sm tracking-wide"
            >
              {loading ? "Enviando..." : "📥 QUIERO LA GUÍA"}
            </button>

            <div className="text-center space-y-1 pt-1">
              <p className="text-xs text-amber-600 font-medium">⭐ Descargado por +200 eCommerce en 2026</p>
              <p className="text-xs text-gray-400">Sin spam. Puedes darte de baja en cualquier momento.</p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
