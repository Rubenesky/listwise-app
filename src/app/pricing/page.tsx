"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import { useUserPlan } from "@/app/api/user/plan/useUserPlan";

const PLAN_LOGO: Record<string, string> = {
  pro: "/logo-pro.png",
  enterprise: "/logo-enterprise.png",
};

const plans = [
  {
    name: "Gratuito",
    price: "0€",
    credits: "10 créditos/mes",
    description: "Perfecto para probar la herramienta",
    features: [
      "10 créditos de uso al mes",
      "Generación básica con IA",
      "Análisis de competidor (2 créditos)",
      "Soporte por email",
    ],
    priceId: "free",
    popular: false,
  },
  {
    name: "Pro",
    price: "29€",
    credits: "1.500 créditos/mes",
    description: "Para tiendas online en crecimiento",
    features: [
      "1.500 créditos de uso al mes",
      "Generación avanzada con IA",
      "🤖 Agente de Copywriting ilimitado",
      "Análisis de competencia ilimitado",
      "Soporte prioritario",
    ],
    priceId: "pro",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "99€",
    credits: "7.000 créditos/mes",
    description: "Para negocios con alto volumen",
    features: [
      "7.000 créditos de uso al mes",
      "Generación avanzada con IA",
      "🤖 Agente de Copywriting ilimitado",
      "Análisis de competencia ilimitado",
      "API personalizada",
      "Dedicated account manager",
      "Soporte 24/7",
    ],
    priceId: "enterprise",
    popular: false,
  },
];

const creditPacks = [
  {
    name: "Pack S",
    credits: 20,
    price: "0,99€",
    priceId: "agent_pack_s",
    description: "Para proyectos puntuales",
    popular: false,
  },
  {
    name: "Pack M",
    credits: 50,
    price: "1,99€",
    priceId: "agent_pack_m",
    description: "El más elegido",
    popular: true,
  },
  {
    name: "Pack L",
    credits: 100,
    price: "2,99€",
    priceId: "agent_pack_l",
    description: "Para alto volumen",
    popular: false,
  },
];

export default function PricingPage() {
  const { isSignedIn } = useUser();
  const { plan } = useUserPlan();
  const logoSrc = PLAN_LOGO[plan] ?? "/logo-transparent.png";
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"plans" | "credits">("plans");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      localStorage.setItem("listwise_referral_code", ref);
      setReferralCode(ref);
      console.log(`🔗 [Pricing] Código de referido guardado: ${ref}`);
    } else {
      const saved = localStorage.getItem("listwise_referral_code");
      if (saved) {
        setReferralCode(saved);
        console.log(`🔗 [Pricing] Código de referido recuperado: ${saved}`);
      }
    }
  }, []);

  const handleSubscribe = async (priceId: string) => {
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    setLoading(priceId);

    try {
      console.log(`💰 [Pricing] Iniciando pago para: ${priceId}`);
      console.log(`🔗 [Pricing] Código de referido: ${referralCode ?? "ninguno"}`);

      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, referralCode }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Error al crear la sesión de pago: " + (data.error || "Error desconocido"));
      }
    } catch {
      alert("Error al procesar el pago. Inténtalo de nuevo.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* ── Navbar ──────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/">
            <Image
              src={logoSrc}
              alt="ListWise"
              width={120}
              height={40}
              className="h-8 w-auto"
              priority
            />
          </Link>
          <div className="flex items-center gap-3">
            {isSignedIn ? (
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600 transition-colors font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="text-sm text-gray-600 hover:text-blue-600 transition-colors hidden sm:block"
                >
                  Iniciar sesión
                </Link>
                <Link
                  href="/sign-up"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 hover:scale-105 transition-all"
                >
                  Crear cuenta gratis
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-5">
        {/* Título */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Elige el plan perfecto para tu negocio
          </h1>
          <p className="mt-1 text-sm text-gray-600 max-w-xl mx-auto">
            Genera descripciones de productos con IA y ahorra horas de trabajo
          </p>
          {referralCode && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full text-sm text-green-700">
              <span>🎁</span>
              <span>
                Invitado con código{" "}
                <span className="font-mono font-semibold">{referralCode}</span> — obtendrás
                créditos extra al suscribirte
              </span>
            </div>
          )}
        </div>

        {/* ── Tab toggle ───────────────────────────────────── */}
        <div className="flex justify-center mb-5">
          <div className="inline-flex bg-gray-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => setActiveTab("plans")}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "plans"
                  ? "bg-white shadow text-blue-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Planes de suscripción
            </button>
            <button
              onClick={() => setActiveTab("credits")}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === "credits"
                  ? "bg-white shadow text-amber-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Créditos de uso
            </button>
          </div>
        </div>

        {/* ── Planes de suscripción ─────────────────────────── */}
        {activeTab === "plans" && <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow overflow-hidden ${
                plan.popular ? "ring-2 ring-blue-600 relative" : ""
              }`}
            >
              {plan.popular && (
                <div className="bg-blue-600 text-white text-center py-1 text-xs font-semibold">
                  Más popular
                </div>
              )}
              <div className="p-5">
                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                <div className="mt-1.5 flex items-baseline">
                  <span className="text-2xl font-extrabold text-gray-900">{plan.price}</span>
                  <span className="ml-1 text-sm text-gray-500">/mes</span>
                </div>
                {"credits" in plan && (
                  <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                    ⚡ {plan.credits}
                  </span>
                )}
                <p className="mt-1 text-xs text-gray-600">{plan.description}</p>

                <ul className="mt-3 space-y-1.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                      <span className="ml-2 text-xs text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4">
                  {plan.priceId === "free" ? (
                    <Link
                      href="/dashboard"
                      className="w-full block text-center px-4 py-2 bg-gray-200 text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-300 hover:scale-105 transition-all"
                    >
                      Ir al dashboard
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(plan.priceId)}
                      disabled={loading === plan.priceId}
                      className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        loading === plan.priceId
                          ? "bg-blue-400 cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700 hover:scale-105"
                      }`}
                    >
                      {loading === plan.priceId ? (
                        <span className="flex items-center justify-center">
                          <svg
                            className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
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
        </div>}

        {/* ── Créditos de uso ──────────────────────────────── */}
        {activeTab === "credits" && <div className="mb-4">
          <div className="text-center mb-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-medium text-amber-700 mb-2">
              <Zap className="w-3.5 h-3.5" />
              Sin suscripción mensual
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              Compra créditos de uso
            </h2>
            <p className="mt-1 text-xs text-gray-600 max-w-md mx-auto">
              Paga solo lo que usas. Los créditos no caducan y se acumulan con tu plan.
              Válidos para descripciones y Agent Mode.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {creditPacks.map((pack) => (
              <div
                key={pack.name}
                className={`bg-white rounded-xl border p-5 text-center hover:shadow-lg transition-shadow relative ${
                  pack.popular ? "ring-2 ring-amber-400" : "border-gray-200"
                }`}
              >
                {pack.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-amber-400 text-white text-xs font-semibold rounded-full whitespace-nowrap">
                    Más elegido
                  </span>
                )}
                <div className="text-xl mb-1">⚡</div>
                <h3 className="font-bold text-gray-900 text-base">{pack.name}</h3>
                <p className="text-xs text-gray-500 mb-2">{pack.description}</p>
                <p className="text-2xl font-extrabold text-gray-900 mb-0.5">{pack.price}</p>
                <p className="text-xs text-gray-400 mb-2">pago único</p>
                <p className="text-sm font-semibold text-blue-600 mb-4">
                  {pack.credits} créditos
                </p>
                <button
                  onClick={() => handleSubscribe(pack.priceId)}
                  disabled={loading === pack.priceId}
                  className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    loading === pack.priceId
                      ? "bg-amber-300 cursor-not-allowed text-white"
                      : "bg-amber-400 text-white hover:bg-amber-500 hover:scale-105"
                  }`}
                >
                  {loading === pack.priceId ? "Procesando..." : "Comprar créditos"}
                </button>
              </div>
            ))}
          </div>

          {/* Credit cost table */}
          <div className="mt-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">¿Cuántos créditos consume cada acción?</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { action: "Generar variantes", cost: 1 },
                { action: "Generar descripción", cost: 1 },
                { action: "Chat con agente IA", cost: 1 },
                { action: "Análisis de competidor", cost: 2 },
                { action: "Subir CSV", cost: 0 },
                { action: "Compartir landing", cost: 0 },
              ].map(({ action, cost }) => (
                <div key={action} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-sm border border-gray-100">
                  <span className="text-gray-600">{action}</span>
                  <span className={`font-bold ${cost === 0 ? "text-green-600" : "text-indigo-600"}`}>
                    {cost === 0 ? "Gratis" : `${cost} crédito${cost > 1 ? "s" : ""}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>}

        {/* Footer */}
        <div className="text-center pb-3">
          <p className="text-gray-600 text-sm">
            ¿Necesitas un plan personalizado?{" "}
            <a href="mailto:contacto@listwise.app" className="text-blue-600 hover:underline">
              Contáctanos
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
