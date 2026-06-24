"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useUser } from "@clerk/nextjs";
import type { Step } from "react-joyride";

const Joyride = dynamic(() => import("react-joyride"), { ssr: false });

const steps: Step[] = [
  {
    target: ".upload-area",
    title: "Sube tu CSV",
    content: "Este es el área de subida. Arrastra tu archivo CSV con los productos o haz clic para seleccionarlo.",
    placement: "top",
    disableBeacon: true,
  },
  {
    target: ".mode-selector",
    title: "Elige el modo de generación",
    content: "Selecciona el estilo de escritura: Creativo (emocional), Profesional (técnico) o SEO (optimizado para buscadores).",
    placement: "bottom",
  },
  {
    target: ".listings-table",
    title: "Tus listados",
    content: "Aquí verás todos tus productos con su estado. Haz clic en cualquier producto para ver y editar el contenido generado.",
    placement: "top",
  },
];

export default function OnboardingTour() {
  const { isSignedIn } = useUser();
  const [run, setRun] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    const hasSeenTour = localStorage.getItem("listwise_tour_seen");
    if (!hasSeenTour) {
      const timer = setTimeout(() => setRun(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [isSignedIn]);

  const handleCallback = (data: { status: string }) => {
    const { status } = data;
    if (status === "finished" || status === "skipped") {
      localStorage.setItem("listwise_tour_seen", "true");
      setRun(false);
    }
  };

  if (!isSignedIn) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      locale={{
        back: "Atrás",
        close: "Cerrar",
        last: "Finalizar",
        next: "Siguiente",
        skip: "Saltar tour",
      }}
      styles={{
        options: {
          primaryColor: "#2563eb",
          textColor: "#1f2937",
          zIndex: 1000,
        },
      }}
      callback={handleCallback}
    />
  );
}
