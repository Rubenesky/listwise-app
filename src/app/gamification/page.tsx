"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { LEVELS } from "@/lib/gamification/constants";

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

interface RankingItem {
  rank: number;
  userId: string;
  points: number;
  level: number;
  levelName: string;
  levelIcon: string;
  badges: string[];
}

const BADGE_META: Record<string, { icon: string; name: string }> = {
  first_product: { icon: "🌟", name: "Primer Producto" },
  sharer: { icon: "📢", name: "Compartidor" },
  ai_user: { icon: "🤖", name: "Usuario IA" },
  level_5: { icon: "🏆", name: "Maestro" },
  level_6: { icon: "⭐", name: "Leyenda" },
};

export default function GamificationPage() {
  const { user } = useUser();
  const [status, setStatus] = useState<GamificationStatus | null>(null);
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    Promise.all([
      fetch("/api/gamification/status").then((r) => r.json()),
      fetch("/api/gamification/ranking").then((r) => r.json()),
    ])
      .then(([s, r]) => {
        setStatus(s);
        setRanking(r.ranking ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    const handleVisibility = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("gamification-update", refresh);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("gamification-update", refresh);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
      </div>
    );
  }

  const progress = status
    ? status.isMaxLevel
      ? 100
      : ((status.points - status.currentLevelPoints) / Math.max(status.nextLevelPoints - status.currentLevelPoints, 1)) * 100
    : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">🏆 Gamificación</h1>
        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">Beta</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: status + levels + badges */}
        <div className="lg:col-span-2 space-y-5">
          {/* Current level card */}
          {status && (
            <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl p-6 text-white">
              <div className="flex items-center gap-4 mb-4">
                <span className="text-4xl">{status.levelIcon}</span>
                <div>
                  <p className="text-sm opacity-75">Nivel {status.level}</p>
                  <p className="text-2xl font-bold">{status.levelName}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-3xl font-bold">{status.points}</p>
                  <p className="text-sm opacity-75">puntos</p>
                </div>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2 mb-1">
                <div
                  className="bg-white h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <p className="text-sm opacity-75">
                {status.isMaxLevel
                  ? "Eres una leyenda. Nivel máximo alcanzado."
                  : `${status.nextLevelPoints - status.points} pts para ${status.nextLevelName}`}
              </p>
              {status.streak > 0 && (
                <p className="text-sm mt-2">🔥 Racha de {status.streak} días activos</p>
              )}
            </div>
          )}

          {/* All levels */}
          <div className="bg-white rounded-xl border p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Todos los niveles</h2>
            <div className="space-y-3">
              {LEVELS.map((l) => {
                const unlocked = (status?.points ?? 0) >= l.minPoints;
                return (
                  <div
                    key={l.level}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      unlocked ? "border-purple-200 bg-purple-50" : "border-gray-100 bg-gray-50 opacity-60"
                    }`}
                  >
                    <span className="text-2xl">{l.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {l.name}
                        {status?.level === l.level && (
                          <span className="ml-2 text-xs text-purple-600 font-normal">← Nivel actual</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">{l.minPoints} puntos para desbloquear</p>
                      {(l.level === 5 || l.level === 6) && (
                        <p className="text-xs text-amber-600 mt-0.5">🎁 Código descuento Pro 15% (3 meses)</p>
                      )}
                    </div>
                    {unlocked ? (
                      <span className="text-green-500 text-lg">✓</span>
                    ) : (
                      <span className="text-gray-300 text-lg">🔒</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Badges */}
          <div className="bg-white rounded-xl border p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Insignias obtenidas</h2>
            {!status || status.badges.length === 0 ? (
              <p className="text-sm text-gray-400">Aún no has ganado insignias. ¡Sigue usando ListWise!</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {status.badges.map((badge) => {
                  const meta = BADGE_META[badge] ?? { icon: "🏅", name: badge };
                  return (
                    <div key={badge} className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <span className="text-xl">{meta.icon}</span>
                      <span className="text-xs font-medium text-gray-700">{meta.name}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* How it works */}
          <div className="bg-white rounded-xl border p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-3">¿Cómo ganar puntos?</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              {[
                ["Subir CSV", "+1 pt"],
                ["Generar producto", "+2 pts"],
                ["Completar producto", "+3 pts"],
                ["Editar descripción", "+1 pt"],
                ["Chat con IA", "+2 pts"],
                ["Compartir landing", "+3 pts"],
                ["Referido convertido", "+15 pts"],
                ["Racha diaria", "+3 pts"],
              ].map(([action, pts]) => (
                <div key={action} className="flex justify-between items-center py-1.5 border-b border-gray-50 text-sm">
                  <span className="text-gray-600">{action}</span>
                  <span className="font-semibold text-purple-600">{pts}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: ranking */}
        <div>
          <div className="bg-white rounded-xl border p-5 sticky top-4">
            <h2 className="text-base font-semibold text-gray-900 mb-4">🌍 Ranking global</h2>
            {ranking.length === 0 ? (
              <p className="text-sm text-gray-400">Sin datos aún.</p>
            ) : (
              <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
                {ranking.slice(0, 20).map((r) => {
                  const isMe = r.userId === user?.id;
                  return (
                    <div
                      key={r.userId}
                      className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                        isMe ? "bg-purple-50 border border-purple-200" : "hover:bg-gray-50"
                      }`}
                    >
                      <span className="text-gray-400 w-5 text-xs font-mono text-right shrink-0">
                        {r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}
                      </span>
                      <span className="text-base shrink-0">{r.levelIcon}</span>
                      <span className="flex-1 text-gray-700 truncate text-xs">
                        {isMe ? "Tú" : `Usuario ${r.userId.slice(0, 8)}`}
                      </span>
                      <span className="text-xs font-semibold text-purple-700 shrink-0">{r.points} pts</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
