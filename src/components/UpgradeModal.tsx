"use client";

import Link from "next/link";
import { Zap, X, Package } from "lucide-react";

interface UpgradeModalProps {
  credits: number;
  onClose: () => void;
  onBuy: (packId: string) => void;
}

const PACKS = [
  { id: "pack_s", label: "20 consultas", price: "1,99 €", desc: "Para empezar" },
  { id: "pack_m", label: "50 consultas", price: "2,99 €", desc: "Más popular", highlight: true },
  { id: "pack_l", label: "100 consultas", price: "3,99 €", desc: "Mejor precio/consulta" },
];

export default function UpgradeModal({ credits, onClose, onBuy }: UpgradeModalProps) {
  const isExhausted = credits === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 pt-6 pb-5">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-amber-300" />
            <span className="text-white font-bold text-lg" id="upgrade-modal-title">
              {isExhausted ? "Consultas agotadas" : `Solo te quedan ${credits} consulta${credits !== 1 ? "s" : ""}`}
            </span>
          </div>
          <p className="text-blue-100 text-sm">
            {isExhausted
              ? "Compra más consultas para seguir optimizando tus listings con IA."
              : "Recarga antes de quedarte sin consultas y no interrumpas tu flujo de trabajo."}
          </p>
        </div>

        {/* Packs */}
        <div className="px-6 pt-5 pb-2 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" />
            Packs de consultas — pago único
          </p>
          {PACKS.map((pack) => (
            <button
              key={pack.id}
              onClick={() => onBuy(pack.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left ${
                pack.highlight
                  ? "border-blue-500 bg-blue-50 shadow-sm"
                  : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
              }`}
            >
              <div>
                <span className="font-semibold text-gray-900 text-sm">{pack.label}</span>
                {pack.highlight && (
                  <span className="ml-2 text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full uppercase">
                    Popular
                  </span>
                )}
                <p className="text-xs text-gray-500 mt-0.5">{pack.desc}</p>
              </div>
              <span className="font-bold text-blue-700 text-base shrink-0 ml-3">{pack.price}</span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="mx-6 my-3 border-t border-gray-100" />

        {/* Pro plan */}
        <div className="px-6 pb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            O pasa a Pro — créditos mensuales incluidos
          </p>
          <Link
            href="/pricing"
            onClick={onClose}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 border-amber-400 bg-amber-50 hover:bg-amber-100 transition-all"
          >
            <div>
              <span className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                Plan Pro
              </span>
              <p className="text-xs text-gray-500 mt-0.5">1.200 créditos/mes · Sin límite de productos</p>
            </div>
            <span className="font-bold text-amber-700 text-base shrink-0 ml-3">29 €/mes</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
