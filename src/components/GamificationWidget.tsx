"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface GamificationStatus {
  points: number;
  level: number;
  levelName: string;
  levelIcon: string;
  currentLevelPoints: number;
  nextLevelPoints: number;
  nextLevelName: string | null;
  isMaxLevel: boolean;
  streak: number;
  badges: string[];
}

export default function GamificationWidget({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<GamificationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    fetch("/api/gamification/status")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("gamification-update", refresh);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("gamification-update", refresh);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const progress = data && !data.isMaxLevel
    ? ((data.points - data.currentLevelPoints) / Math.max(data.nextLevelPoints - data.currentLevelPoints, 1)) * 100
    : 100;

  if (compact) {
    if (loading) {
      return (
        <div className="bg-white rounded-lg border border-purple-100 px-4 py-2.5 animate-pulse flex items-center gap-3">
          <div className="h-3 bg-gray-200 rounded w-40" />
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full" />
          <div className="h-3 bg-gray-200 rounded w-24" />
        </div>
      );
    }
    if (!data) return null;
    return (
      <div className="bg-white rounded-lg border border-purple-100 px-4 py-2.5 flex items-center gap-3">
        <span className="text-base shrink-0">{data.levelIcon}</span>
        <span className="text-sm font-medium text-gray-700 shrink-0">
          {data.levelName} · <span className="text-purple-600 font-semibold">{data.points} pts</span>
        </span>
        <div className="flex-1 min-w-0">
          <div className="w-full bg-purple-100 rounded-full h-1.5">
            <div
              className="bg-purple-600 h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
        <span className="text-xs text-gray-400 shrink-0 hidden sm:block">
          {data.isMaxLevel ? "Nivel máximo" : `→ ${data.nextLevelName}`}
        </span>
        {data.streak > 0 && <span className="text-xs shrink-0">🔥{data.streak}</span>}
        <Link href="/gamification" className="text-xs text-purple-600 hover:text-purple-800 font-medium shrink-0">
          Ver →
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
        <div className="h-2 bg-gray-200 rounded w-full mb-2" />
        <div className="h-3 bg-gray-200 rounded w-1/3" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg border border-purple-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{data.levelIcon}</span>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-gray-900">{data.levelName}</p>
              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">Beta</span>
            </div>
            <p className="text-xs text-gray-500">{data.points} puntos</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {data.streak > 0 && (
            <span title="Racha de días activos">🔥 {data.streak}</span>
          )}
          {data.badges.length > 0 && (
            <span title="Insignias">🏅 {data.badges.length}</span>
          )}
        </div>
      </div>

      <div className="w-full bg-purple-100 rounded-full h-1.5 mb-1">
        <div
          className="bg-purple-600 h-1.5 rounded-full transition-all"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mb-3">
        {data.isMaxLevel
          ? "Nivel máximo alcanzado"
          : `${data.nextLevelPoints - data.points} pts para ${data.nextLevelName || "siguiente nivel"}`}
      </p>

      <Link href="/gamification" className="text-xs text-purple-600 hover:text-purple-800 font-medium">
        Ver detalles →
      </Link>
    </div>
  );
}
