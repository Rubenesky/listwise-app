"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";

const BADGE_LABELS: Record<string, { label: string; icon: string }> = {
  first_product: { label: "Primer producto generado", icon: "🚀" },
  sharer: { label: "Primer listing compartido", icon: "📤" },
  ai_user: { label: "Usuario del Agente IA", icon: "🤖" },
  level_5: { label: "Nivel Maestro alcanzado", icon: "🏆" },
  level_6: { label: "Nivel Leyenda alcanzado", icon: "⭐" },
};

interface GamStatus {
  level: number;
  levelName: string;
  levelIcon: string;
  badges: string[];
}

interface Toast {
  icon: string;
  title: string;
  sub: string;
}

export default function GamificationToast() {
  const { isSignedIn } = useUser();
  const prevRef = useRef<GamStatus | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((t: Toast) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(t);
    requestAnimationFrame(() => setVisible(true));
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(() => setToast(null), 300);
    }, 5000);
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;

    fetch("/api/gamification/status")
      .then((r) => r.json())
      .then((d: GamStatus) => { prevRef.current = d; })
      .catch(() => {});

    const handleUpdate = () => {
      fetch("/api/gamification/status")
        .then((r) => r.json())
        .then((next: GamStatus) => {
          const prev = prevRef.current;
          if (!prev) { prevRef.current = next; return; }

          if (next.level > prev.level) {
            showToast({
              icon: next.levelIcon,
              title: "¡Subiste de nivel!",
              sub: `Ahora eres ${next.levelIcon} ${next.levelName}`,
            });
          } else {
            const newBadges = next.badges.filter((b) => !prev.badges.includes(b));
            if (newBadges.length > 0) {
              const badge = BADGE_LABELS[newBadges[0]];
              if (badge) {
                showToast({
                  icon: badge.icon,
                  title: "¡Nueva insignia desbloqueada!",
                  sub: badge.label,
                });
              }
            }
          }

          prevRef.current = next;
        })
        .catch(() => {});
    };

    window.addEventListener("gamification-update", handleUpdate);
    return () => window.removeEventListener("gamification-update", handleUpdate);
  }, [isSignedIn, showToast]);

  if (!toast) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 z-[9998] max-w-xs w-full transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-4 flex items-start gap-3">
        <div className="text-3xl flex-shrink-0 leading-none">{toast.icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900">{toast.title}</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{toast.sub}</p>
        </div>
        <button
          onClick={() => { setVisible(false); setTimeout(() => setToast(null), 300); }}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors p-0.5"
          aria-label="Cerrar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
