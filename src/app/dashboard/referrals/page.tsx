"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

interface ReferralStats {
  total: number;
  pending: number;
  registered: number;
  converted: number;
}

interface Badge {
  id: string;
  type: string;
  name: string;
  icon: string;
  earnedAt: number;
}

interface Referral {
  id: string;
  email: string | null;
  status: string;
  createdAt: number;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "text-yellow-700 bg-yellow-50 border-yellow-200" },
  registered: { label: "Registrado", color: "text-blue-700 bg-blue-50 border-blue-200" },
  converted: { label: "Convertido", color: "text-green-700 bg-green-50 border-green-200" },
};

export default function ReferralsPage() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();

  const [stats, setStats] = useState<ReferralStats>({ total: 0, pending: 0, registered: 0, converted: 0 });
  const [credits, setCredits] = useState(0);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.push("/sign-in");
  }, [isLoaded, isSignedIn, router]);

  const fetchAll = useCallback(async () => {
    try {
      const [codeRes, statsRes, creditsRes, badgesRes, listRes] = await Promise.all([
        fetch("/api/referrals/generate", { method: "POST" }),
        fetch("/api/referrals/stats"),
        fetch("/api/referrals/credits"),
        fetch("/api/referrals/badges"),
        fetch("/api/referrals/list"),
      ]);

      const [codeData, statsData, creditsData, badgesData, listData] = await Promise.all([
        codeRes.json(),
        statsRes.json(),
        creditsRes.json(),
        badgesRes.json(),
        listRes.json(),
      ]);

      if (codeData.code) setCode(codeData.code);
      if (statsData.total !== undefined) setStats(statsData);
      setCredits(creditsData.credits ?? 0);
      setBadges(badgesData.badges ?? []);
      setReferrals(listData.referrals ?? []);
    } catch {
      // silent — UI shows empty states
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSignedIn) fetchAll();
  }, [isSignedIn, fetchAll]);

  const appUrl = "https://listwise-app.onrender.com";

  const copyCode = async () => {
    const url = `${appUrl}/sign-up?ref=${code}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareCode = async () => {
    const url = `${appUrl}/sign-up?ref=${code}`;
    const text = `🎁 ¡Genera descripciones de productos con IA! Únete a ListWise con mi enlace y obtén créditos extra al registrarte. 👉 ${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "ListWise — Invitación", text });
      } catch {
        // user cancelled
      }
    } else {
      await copyCode();
    }
  };

  if (!isLoaded || !isSignedIn || loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  const nextMilestone = stats.converted < 5 ? 5 : stats.converted < 10 ? 10 : null;
  const milestoneProgress = nextMilestone
    ? Math.min((stats.converted / nextMilestone) * 100, 100)
    : 100;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🎁 Invita y Gana Recompensas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Comparte ListWise con amigos y gana créditos, meses gratis e insignias exclusivas.
        </p>
      </div>

      {/* Referral link card */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg">
        <p className="text-sm text-blue-100 mb-1">Tu enlace de invitación</p>
        <p className="font-mono text-base font-bold mb-4 break-all">
          {appUrl}/sign-up?ref=<span className="text-yellow-300">{code || "..."}</span>
        </p>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={copyCode}
            disabled={!code}
            className="px-4 py-2 bg-white text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors disabled:opacity-50"
          >
            {copied ? "✅ Copiado" : "📋 Copiar enlace"}
          </button>
          <button
            onClick={shareCode}
            disabled={!code}
            className="px-4 py-2 bg-white/20 border border-white/30 text-white rounded-lg text-sm font-semibold hover:bg-white/30 transition-colors disabled:opacity-50"
          >
            🔗 Compartir
          </button>
        </div>
        <p className="text-xs text-blue-200 mt-3">
          Código: <span className="font-mono font-bold text-white">{code}</span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total invitados", value: stats.total, color: "text-gray-900" },
          { label: "Pendientes", value: stats.pending, color: "text-yellow-600" },
          { label: "Registrados", value: stats.registered, color: "text-blue-600" },
          { label: "Convertidos", value: stats.converted, color: "text-green-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Credits + milestone */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm font-semibold text-gray-800">💰 Tus créditos</p>
            <p className="text-xs text-gray-400">Cada conversión suma créditos para ti y para quien se registra</p>
          </div>
          <span className="text-2xl font-bold text-blue-600">{credits}</span>
        </div>
        {nextMilestone && (
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Progreso hacia {nextMilestone} conversiones</span>
              <span>{stats.converted} / {nextMilestone}</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                style={{ width: `${milestoneProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Te faltan{" "}
              <span className="font-semibold text-indigo-600">{nextMilestone - stats.converted}</span>{" "}
              para ganar {nextMilestone === 5 ? "1 mes Pro gratis" : "1 mes Enterprise gratis"}
            </p>
          </div>
        )}
      </div>

      {/* Badges */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">🏅 Insignias</h2>
        {badges.length > 0 && (
          <div className="flex gap-5 flex-wrap mb-4">
            {badges.map((badge) => (
              <div key={badge.id} className="flex flex-col items-center gap-1">
                <span className="text-3xl">{badge.icon}</span>
                <p className="text-xs text-gray-600 font-medium text-center">{badge.name}</p>
              </div>
            ))}
          </div>
        )}
        <div className={badges.length > 0 ? "pt-3 border-t border-gray-100" : ""}>
          {badges.length === 0 && (
            <p className="text-xs text-gray-400 mb-3">Invita a alguien para ganar tu primera insignia</p>
          )}
          <div className="flex gap-4 flex-wrap">
            {[
              { icon: "🌱", name: "Primer Referido" },
              { icon: "⭐", name: "5 Referidos" },
              { icon: "🏆", name: "10 Referidos" },
            ]
              .filter((b) => !badges.some((earned) => earned.icon === b.icon))
              .map((b) => (
                <div key={b.name} className="flex flex-col items-center gap-1 opacity-30">
                  <span className="text-3xl grayscale">{b.icon}</span>
                  <p className="text-xs text-gray-500 text-center">{b.name}</p>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Referrals history table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-800">📋 Historial de invitaciones</h2>
        </div>
        {referrals.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-3xl mb-2">📨</p>
            <p className="text-sm text-gray-500">Aún no tienes invitaciones. ¡Comparte tu enlace!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {referrals.map((ref) => {
                  const status = STATUS_MAP[ref.status] ?? {
                    label: ref.status,
                    color: "text-gray-600 bg-gray-50 border-gray-200",
                  };
                  return (
                    <tr key={ref.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-700">
                        {ref.email ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {ref.createdAt
                          ? new Date(ref.createdAt * 1000).toLocaleDateString("es-ES")
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200 p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">🏆 ¿Cómo funciona?</h3>
        <div className="space-y-2 text-sm text-gray-600 mb-4">
          <div className="flex items-start gap-2">
            <span className="shrink-0">1️⃣</span>
            <span>Comparte tu enlace con amigos o en redes sociales.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="shrink-0">2️⃣</span>
            <span>Cuando se registran con tu enlace, ambos ganáis créditos.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="shrink-0">3️⃣</span>
            <span>Cuando se suscriben a un plan de pago, tú ganas meses gratis.</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs border-t border-purple-100 pt-3">
          {[
            { icon: "🌱", title: "1 conversión", reward: "Insignia" },
            { icon: "⭐", title: "5 conversiones", reward: "1 mes Pro gratis" },
            { icon: "🏆", title: "10 conversiones", reward: "1 mes Enterprise" },
          ].map((r) => (
            <div key={r.title}>
              <span className="text-xl">{r.icon}</span>
              <p className="text-gray-700 font-medium mt-0.5">{r.title}</p>
              <p className="text-gray-400">{r.reward}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
