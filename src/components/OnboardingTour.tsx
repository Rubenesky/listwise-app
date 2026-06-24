"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";

const STEPS = [
  {
    target: ".upload-area",
    title: "📤 Sube tu CSV",
    content: "Arrastra tu archivo CSV aquí o haz clic para seleccionarlo. Descarga la plantilla para ver el formato correcto.",
  },
  {
    target: ".mode-selector",
    title: "🎨 Elige el modo",
    content: "Selecciona el estilo de escritura antes de subir: Creativo (emocional), Profesional (técnico) o SEO (para buscadores).",
  },
  {
    target: ".listings-table",
    title: "📊 Tus listados",
    content: "Aquí verás todos tus productos. Haz clic en cualquiera para ver y editar el contenido generado por la IA.",
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
      const timer = setTimeout(() => setVisible(true), 1200);
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
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 pointer-events-auto"
        onClick={finish}
      />

      {/* Tooltip card */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-80 bg-white rounded-xl shadow-2xl p-5 pointer-events-auto z-10">
        {/* Progress dots */}
        <div className="flex gap-1.5 mb-3">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-blue-600" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        <p className="font-semibold text-gray-900 text-sm mb-1">{current.title}</p>
        <p className="text-sm text-gray-600 mb-4">{current.content}</p>

        <div className="flex justify-between items-center">
          <button
            onClick={finish}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Saltar tour
          </button>
          <button
            onClick={handleNext}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            {step < STEPS.length - 1 ? "Siguiente →" : "Finalizar"}
          </button>
        </div>
      </div>
    </div>
  );
}
