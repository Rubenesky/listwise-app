"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle } from "lucide-react";
import { useState } from "react";

const plans = [
  {
    name: "Gratuito",
    price: "0€",
    description: "Perfecto para probar la herramienta",
    features: [
      "10 productos/mes",
      "Generación básica",
      "Soporte por email",
    ],
    priceId: "free",
    popular: false,
  },
  {
    name: "Pro",
    price: "29€",
    description: "Para tiendas online en crecimiento",
    features: [
      "500 productos/mes",
      "Generación avanzada con IA",
      "Soporte prioritario",
      "Análisis de competencia",
    ],
    priceId: "pro",
    popular: true,
  },
  {
    name: "Empresa",
    price: "99€",
    description: "Para negocios con alto volumen",
    features: [
      "Productos ilimitados",
      "Generación avanzada con IA",
      "Soporte 24/7",
      "Análisis de competencia",
      "API personalizada",
      "Dedicated account manager",
    ],
    priceId: "enterprise",
    popular: false,
  },
];

export default function PricingPage() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (priceId: string) => {
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    setLoading(priceId);

    try {
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ priceId }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Error al crear la sesión de pago: " + (data.error || "Error desconocido"));
      }
    } catch (error) {
      alert("Error al procesar el pago. Inténtalo de nuevo.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Logo - Tamaño grande con sombra y fondo transparente */}
        <div className="flex justify-center mb-8">
          <Image
            src="/logo-transparent.png"
            alt="ListWise"
            width={350}
            height={110}
            className="h-28 w-auto drop-shadow-xl"  // Cambiado de h-20 a h-28
            priority
          />
        </div>

        {/* Título */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">
            Elige el plan perfecto para tu negocio
          </h1>
          <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
            Genera descripciones de productos con IA y ahorra horas de trabajo
          </p>
        </div>

        {/* Planes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`bg-white rounded-2xl shadow-lg overflow-hidden ${
                plan.popular ? "ring-2 ring-blue-600 relative" : ""
              }`}
            >
              {plan.popular && (
                <div className="bg-blue-600 text-white text-center py-1.5 text-sm font-semibold">
                  Más popular
                </div>
              )}
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <div className="mt-4 flex items-baseline">
                  <span className="text-3xl font-extrabold text-gray-900">
                    {plan.price}
                  </span>
                  <span className="ml-1 text-gray-500">/mes</span>
                </div>
                <p className="mt-2 text-gray-600">{plan.description}</p>

                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      <span className="ml-3 text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8">
                  {plan.priceId === "free" ? (
                    <Link
                      href="/dashboard"
                      className="w-full block text-center px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                    >
                      Ir al dashboard
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(plan.priceId)}
                      disabled={loading === plan.priceId}
                      className={`w-full px-4 py-3 rounded-lg font-medium transition-colors ${
                        loading === plan.priceId
                          ? "bg-blue-400 cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      {loading === plan.priceId ? (
                        <span className="flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Procesando...
                        </span>
                      ) : (
                        `Suscribirse por ${plan.price}/mes`
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-gray-600">
            ¿Necesitas un plan personalizado?{" "}
            <a href="mailto:contacto@listwise.com" className="text-blue-600 hover:underline">
              Contáctanos
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}