"use client";

import { useEffect, useState } from "react";
import { Bot, Zap, MessageSquare, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";

const QUICK_EXAMPLES = [
  { icon: "✂️", label: "Acórtala a 100 palabras", desc: "Versión concisa y directa" },
  { icon: "🎯", label: "Añade keywords SEO", desc: "Mejora el posicionamiento" },
  { icon: "⚡", label: "Hazla más juvenil", desc: "Tono fresco y cercano" },
  { icon: "💼", label: "Hazla más formal", desc: "Estilo profesional y serio" },
];

export default function AgentPage() {
  const [credits, setCredits] = useState<number | "ilimitado">(0);
  const [plan, setPlan] = useState("free");
  const [loadingCredits, setLoadingCredits] = useState(true);

  useEffect(() => {
    fetch("/api/agent/credits/status")
      .then((r) => r.json())
      .then((d) => {
        setCredits(d.credits ?? 0);
        setPlan(d.plan ?? "free");
      })
      .catch(() => {})
      .finally(() => setLoadingCredits(false));
  }, []);

  const isLow = credits !== "ilimitado" && typeof credits === "number" && credits <= 5;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-8 text-white shadow-lg">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <Bot className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Agente de Copywriting</h1>
                <p className="text-blue-200 text-sm">Powered by IA</p>
              </div>
            </div>
            <p className="text-blue-100 text-base max-w-xl">
              Conversa con la IA para mejorar tus descripciones de producto al instante.
              Selecciona un producto en el dashboard y abre el agente para empezar.
            </p>
          </div>

          {/* Créditos */}
          <div className="shrink-0 bg-white/10 backdrop-blur rounded-xl px-5 py-4 text-center min-w-[120px]">
            <Zap className="w-5 h-5 mx-auto mb-1 text-amber-300" />
            {loadingCredits ? (
              <div className="h-6 w-12 mx-auto bg-white/20 rounded animate-pulse" />
            ) : (
              <p className={`text-2xl font-bold ${isLow ? "text-red-300" : "text-white"}`}>
                {credits === "ilimitado" ? "∞" : credits}
              </p>
            )}
            <p className="text-blue-200 text-xs mt-0.5">consultas</p>
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-blue-700 rounded-lg font-semibold text-sm hover:bg-blue-50 hover:scale-105 transition-all"
          >
            <MessageSquare className="w-4 h-4" />
            Abrir el agente en el dashboard
            <ArrowRight className="w-4 h-4" />
          </Link>
          {plan === "free" && (
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 border border-white/30 text-white rounded-lg font-semibold text-sm hover:bg-white/20 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Ampliar consultas
            </Link>
          )}
        </div>
      </div>

      {/* ── Aviso créditos bajos ─────────────────────────────── */}
      {!loadingCredits && isLow && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <Zap className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              Quedan pocas consultas ({credits})
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Consigue más créditos para seguir usando el agente sin interrupciones.
            </p>
          </div>
          <Link
            href="/pricing"
            className="shrink-0 px-4 py-2 bg-amber-400 text-white rounded-lg text-sm font-medium hover:bg-amber-500 hover:scale-105 transition-all"
          >
            Comprar créditos
          </Link>
        </div>
      )}

      {/* ── Ejemplos de uso ──────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-500" />
          ¿Qué puedes pedirle al agente?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {QUICK_EXAMPLES.map((ex) => (
            <div
              key={ex.label}
              className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md hover:border-blue-200 transition-all"
            >
              <span className="text-2xl">{ex.icon}</span>
              <div>
                <p className="font-semibold text-gray-900 text-sm">"{ex.label}"</p>
                <p className="text-xs text-gray-500 mt-0.5">{ex.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Cómo funciona ────────────────────────────────────── */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Cómo usar el agente</h2>
        <ol className="space-y-3">
          {[
            "Ve al Dashboard y selecciona un producto ya completado.",
            "Haz clic en el botón 🤖 para abrir el chat del agente.",
            "Escribe tu instrucción o usa los accesos rápidos de la barra.",
            "Aplica los cambios generados directamente al listing con un clic.",
          ].map((text, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-sm text-gray-700">{text}</p>
            </li>
          ))}
        </ol>
        <Link
          href="/dashboard"
          className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 hover:scale-105 transition-all"
        >
          Empezar ahora
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
