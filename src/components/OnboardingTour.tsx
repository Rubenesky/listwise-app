"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";

const STEPS = [
  {
    title: "¡Bienvenido/a a ListWise! 🎉",
    content: "En menos de 60 segundos tendrás tu primer listing optimizado con IA. Te guiamos en 3 pasos.",
    cta: null,
  },
  {
    title: "📤 Paso 1 — Sube tu CSV",
    content: "Descarga la plantilla, añade los nombres de tus productos y súbela. La IA generará título, bullets y descripción por cada uno.",
    cta: { label: "⬇ Descargar plantilla CSV", href: "/api/template/csv", download: true },
  },
  {
    title: "🤖 Paso 2 — Refina con el Agente",
    content: "Una vez generados, el Agente de Copywriting te permite perfeccionar cualquier listing con instrucciones en lenguaje natural: tono, keywords, marketplace...",
    cta: { label: "Ir al Agente →", href: "/agent", download: false },
  },
  {
    title: "🔍 Paso 3 — Analiza a tu competencia",
    content: "Pega la URL de un competidor. La IA detecta sus keywords, puntúa su listing y te sugiere exactamente qué mejorar para superarlo.",
    cta: { label: "Ver Competidores →", href: "/dashboard/competitor", download: false },
  },
];

export default function OnboardingTour() {
  const { isSignedIn } = useUser();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    const hasSeenTour = localStorage.getItem("listwise_tour_seen");
    if (!hasSeenTour) {
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [isSignedIn]);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      finish();
    }
  };

  const finish = () => {
    localStorage.setItem("listwise_tour_seen", "true");
    setVisible(false);
  };

  if (!isSignedIn || !visible) return null;

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        className="absolute inset-0 bg-black/50 pointer-events-auto"
        onClick={finish}
      />

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl p-6 pointer-events-auto z-10 animate-fade-in">
        {/* Progress bar */}
        <div className="flex gap-1.5 mb-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i <= step ? "bg-blue-600" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        <p className="font-bold text-gray-900 text-sm mb-1.5">{current.title}</p>
        <p className="text-sm text-gray-600 mb-4 leading-relaxed">{current.content}</p>

        {current.cta && (
          <Link
            href={current.cta.href}
            download={current.cta.download || undefined}
            onClick={finish}
            className="inline-block mb-4 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-lg font-medium transition-colors"
          >
            {current.cta.label}
          </Link>
        )}

        <div className="flex justify-between items-center">
          <button
            onClick={finish}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Saltar
          </button>
          <button
            onClick={handleNext}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
          >
            {step < STEPS.length - 1 ? "Siguiente →" : "¡Empezar! 🚀"}
          </button>
        </div>
      </div>
    </div>
  );
}
