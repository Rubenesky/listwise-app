"use client";

import { useState } from "react";

const STEPS = [
  {
    emoji: "📤",
    title: "Sube tu CSV",
    desc: "Descarga la plantilla, añade los nombres de tus productos y sube el archivo. La IA hace el resto.",
    tip: "Un CSV de 10 productos tarda menos de 30 segundos en procesarse.",
  },
  {
    emoji: "⚡",
    title: "La IA genera todo",
    desc: "Título optimizado, 5 bullets de venta y descripción completa para cada producto, al instante.",
    tip: "Puedes elegir tono, marketplace y segmento de precio antes de generar.",
  },
  {
    emoji: "🤖",
    title: "Refina con el Agente",
    desc: "El Agente de Copywriting ajusta cualquier detalle con lenguaje natural. Solo dile qué cambiar.",
    tip: "Usa las plantillas de prompt para empezar rápido: tono, keywords, versión en inglés…",
  },
];

interface Props {
  onDismiss: () => void;
}

export default function OnboardingModal({ onDismiss }: Props) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function finish() {
    try { localStorage.setItem("lw_onboarding_v1_done", "1"); } catch { /* ignore */ }
    onDismiss();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-8">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-4">
            Paso {step + 1} de {STEPS.length}
          </p>

          <div className="text-5xl mb-4">{current.emoji}</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{current.title}</h2>
          <p className="text-gray-600 text-sm leading-relaxed mb-4">{current.desc}</p>
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-700">
            💡 {current.tip}
          </div>

          <div className="flex justify-center gap-2 mt-6 mb-6">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`w-2 h-2 rounded-full transition-colors ${i === step ? "bg-blue-600" : "bg-gray-200"}`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={finish}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Saltar tutorial
            </button>
            <div className="flex gap-2">
              {step > 0 && (
                <button
                  onClick={() => setStep((s) => s - 1)}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Atrás
                </button>
              )}
              {isLast ? (
                <button
                  onClick={finish}
                  className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  ¡Empezar! →
                </button>
              ) : (
                <button
                  onClick={() => setStep((s) => s + 1)}
                  className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Siguiente →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
