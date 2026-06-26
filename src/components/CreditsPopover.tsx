"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Zap } from "lucide-react";

const ACTION_COSTS = [
  { label: "Generar variantes", cost: 1 },
  { label: "Generar descripción", cost: 1 },
  { label: "Chat con agente IA", cost: 1 },
  { label: "Análisis de competidor", cost: 2 },
  { label: "Compartir landing", cost: 0 },
];

export default function CreditsPopover() {
  const [credits, setCredits] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchCredits = () => {
    fetch("/api/user/credits")
      .then((r) => r.json())
      .then((d) => {
        setCredits(d.credits ?? 0);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchCredits();

    const handleUpdate = (e: Event) => {
      const ce = e as CustomEvent<{ credits: number }>;
      if (typeof ce.detail?.credits === "number" && ce.detail.credits >= 0) {
        setCredits(ce.detail.credits);
      } else {
        fetchCredits();
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchCredits();
    };

    window.addEventListener("credits-update", handleUpdate);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("credits-update", handleUpdate);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isLow = typeof credits === "number" && credits <= 3;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
          isLow
            ? "text-red-700 bg-red-50 border-red-200 hover:bg-red-100"
            : "text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100"
        }`}
      >
        <Zap className="w-3 h-3" />
        <span>Créditos: {credits ?? "—"}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 z-50 p-3">
          <p className="text-xs font-semibold text-gray-700 mb-2.5">Coste por acción</p>
          <div className="space-y-1.5">
            {ACTION_COSTS.map(({ label, cost }) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <span className="text-gray-500">{label}</span>
                <span className={cost === 0 ? "font-semibold text-green-600" : "font-semibold text-indigo-600"}>
                  {cost === 0 ? "Gratis" : `${cost} crédito${cost > 1 ? "s" : ""}`}
                </span>
              </div>
            ))}
          </div>
          <Link
            href="/pricing"
            onClick={() => setOpen(false)}
            className="mt-3 block w-full text-center text-xs font-semibold py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Comprar créditos →
          </Link>
        </div>
      )}
    </div>
  );
}
