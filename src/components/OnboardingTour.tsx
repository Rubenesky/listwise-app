"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import type { Step } from "react-joyride";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [Joyride, setJoyride] = useState<any>(null);
  const [run, setRun] = useState(false);

  // Load react-joyride only on the client — avoids SSR/window issues entirely
  useEffect(() => {
    import("react-joyride").then((mod) => {
      // Use functional form of setState to store a function without React calling it
      setJoyride(() => mod.default);
    });
  }, []);

  useEffect(() => {
    if (!isSignedIn || !Joyride) return;
    const hasSeenTour = localStorage.getItem("listwise_tour_seen");
    if (!hasSeenTour) {
      const timer = setTimeout(() => setRun(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [isSignedIn, Joyride]);

  const handleCallback = (data: { status: string }) => {
    if (data.status === "finished" || data.status === "skipped") {
      localStorage.setItem("listwise_tour_seen", "true");
      setRun(false);
    }
  };

  if (!isSignedIn || !Joyride) return null;

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
