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

  const [showShareMenu, setShowShareMenu] = useState(false);

  const SHARE_PLATFORMS = [
    {
      label: "WhatsApp", color: "#25D366",
      svg: (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>),
      getHref: (text: string, _u: string) => `https://wa.me/?text=${text}`,
    },
    {
      label: "X (Twitter)", color: "#000000",
      svg: (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.713 5.963zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>),
      getHref: (text: string, _u: string) => `https://twitter.com/intent/tweet?text=${text}`,
    },
    {
      label: "Facebook", color: "#1877F2",
      svg: (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>),
      getHref: (_t: string, encodedUrl: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      label: "Telegram", color: "#229ED9",
      svg: (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>),
      getHref: (text: string, encodedUrl: string) => `https://t.me/share/url?url=${encodedUrl}&text=${text}`,
    },
    {
      label: "Email", color: "#6B7280",
      svg: (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>),
      getHref: (text: string, _u: string) => `mailto:?subject=${encodeURIComponent("Te invito a ListWise")}&body=${text}`,
    },
  ];

  const getShareLinks = () => {
    const url = `${appUrl}/sign-up?ref=${code}`;
    const text = encodeURIComponent(`🎁 ¡Genera descripciones de productos con IA! Únete a ListWise y obtén 10 créditos extra. 👉 ${url}`);
    const encodedUrl = encodeURIComponent(url);
    return SHARE_PLATFORMS.map(({ label, color, svg, getHref }) => ({ label, color, svg, href: getHref(text, encodedUrl) }));
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
          <div className="relative">
            <button
              onClick={() => setShowShareMenu((v) => !v)}
              disabled={!code}
              className="px-4 py-2 bg-white/20 border border-white/30 text-white rounded-lg text-sm font-semibold hover:bg-white/30 transition-colors disabled:opacity-50"
            >
              🔗 Compartir
            </button>
            {showShareMenu && (
              <div className="absolute left-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-2 min-w-[160px]">
                {getShareLinks().map(({ label, color, svg, href }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowShareMenu(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <span style={{ color }} className="flex items-center">{svg}</span>
                    <span>{label}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
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
        <h2 className="text-sm font-semibold text-gray-800 mb-1">🏅 Insignias</h2>
        <p className="text-xs text-gray-400 mb-3">Se desbloquean cuando tus invitados se registran o contratan un plan</p>

        {/* Registration badges */}
        <p className="text-xs font-medium text-gray-500 mb-2">Por registro:</p>
        <div className="flex gap-4 flex-wrap mb-4">
          {[
            { type: "first_referral", icon: "🤝", name: "Primer Registro" },
            { type: "5_referrals", icon: "💫", name: "5 Registros" },
            { type: "10_referrals", icon: "👑", name: "10 Registros" },
          ].map((b) => {
            const earned = badges.find((e) => e.type === b.type);
            return (
              <div key={b.type} className={`flex flex-col items-center gap-1 ${earned ? "" : "opacity-30 grayscale"}`}>
                <span className="text-3xl">{b.icon}</span>
                <p className="text-xs text-gray-600 font-medium text-center">{b.name}</p>
              </div>
            );
          })}
        </div>

        {/* Conversion badges */}
        <p className="text-xs font-medium text-gray-500 mb-2">Por conversión (pago):</p>
        <div className="flex gap-4 flex-wrap">
          {[
            { type: "first_conversion", icon: "🌟", name: "Primer Convertido" },
            { type: "5_conversions", icon: "💫", name: "5 Convertidos" },
            { type: "10_conversions", icon: "👑", name: "10 Convertidos" },
          ].map((b) => {
            const earned = badges.find((e) => e.type === b.type);
            return (
              <div key={b.type} className={`flex flex-col items-center gap-1 ${earned ? "" : "opacity-30 grayscale"}`}>
                <span className="text-3xl">{b.icon}</span>
                <p className="text-xs text-gray-600 font-medium text-center">{b.name}</p>
              </div>
            );
          })}
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
            <span>Cuando se registran con tu enlace, <strong>ambos ganáis 10 créditos de uso</strong> al instante.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="shrink-0">3️⃣</span>
            <span>Cuando se suscriben a un plan de pago, tú ganas meses gratis.</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs border-t border-purple-100 pt-3">
          {[
            { icon: "🤝", title: "1 conversión", reward: "Insignia" },
            { icon: "💫", title: "5 conversiones", reward: "1 mes Pro gratis" },
            { icon: "👑", title: "10 conversiones", reward: "1 mes Enterprise" },
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
