"use client";

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
    credits: "20 créditos/mes",
    description: "Perfecto para probar la herramienta",
    features: [
      "20 créditos de uso al mes",
      "Generación básica con IA",
      "Soporte por email",
    ],
    priceId: "free",
    popular: false,
  },
  {
    name: "Pro",
    price: "29€",
    credits: "1.200 créditos/mes",
    description: "Para tiendas online en crecimiento",
    features: [
      "1.200 créditos de uso al mes",
      "Generación avanzada con IA",
      "🤖 Agente de Copywriting incluido",
      "Soporte prioritario",
    ],
    priceId: "pro",
    priceIdAnnual: "price_1TncET1uySlskct3tPbtAzJA",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "99€",
    credits: "5.000 créditos/mes",
    description: "Para negocios con alto volumen",
    features: [
      "5.000 créditos de uso al mes",
      "Generación avanzada con IA",
      "🤖 Agente de Copywriting incluido",
      "API personalizada",
      "Dedicated account manager",
      "Soporte 24/7",
    ],
    priceId: "enterprise",
    priceIdAnnual: "price_1TncFM1uySlskct3Lin2vkKE",
    popular: false,
  },
];

const creditPacks = [
  {
    name: "Pack S",
    credits: 20,
    price: "1,99€",
    priceId: "agent_pack_s",
    description: "Para proyectos puntuales",
    popular: false,
  },
  {
    name: "Pack M",
    credits: 50,
    price: "2,99€",
    priceId: "agent_pack_m",
    description: "El más elegido",
    popular: true,
  },
  {
    name: "Pack L",
    credits: 100,
    price: "3,99€",
    priceId: "agent_pack_l",
    description: "Para alto volumen",
    popular: false,
  },
];

interface PricingPageClientProps {
  isSignedIn: boolean;
}

export default function PricingPageClient({ isSignedIn }: PricingPageClientProps) {
  const { plan } = useUserPlan();
  const logoSrc = PLAN_LOGO[plan] ?? "/logo-transparent.png";
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"plans" | "credits">("plans");
  const [subscriptionModal, setSubscriptionModal] = useState<{ message: string; currentPlan: string } | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [productsPerMonth, setProductsPerMonth] = useState(50);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      localStorage.setItem("listwise_referral_code", ref);
      setReferralCode(ref);
    } else {
      const saved = localStorage.getItem("listwise_referral_code");
      if (saved) {
        setReferralCode(saved);
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

      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, referralCode }),
      });

      const data = await response.json();

      if (response.status === 409 && data.alreadySubscribed) {
        setSubscriptionModal({ message: data.error, currentPlan: data.currentPlan });
        return;
      }

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

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const response = await fetch("/api/stripe/create-portal-session", { method: "POST" });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Error al abrir el portal de facturación: " + (data.error || "Error desconocido"));
      }
    } catch {
      alert("Error al abrir el portal de facturación. Inténtalo de nuevo.");
    } finally {
      setPortalLoading(false);
    }
  };

  const getSubscriptionButtonLabel = (planPriceId: string) => {
    if (plan === planPriceId) return "Plan actual ✓";
    if (plan === "pro" && planPriceId === "enterprise") return "Mejorar a Enterprise ↗";
    if (plan === "enterprise") return "Plan máximo activo";
    return `Suscribirse por ${plans.find((p) => p.priceId === planPriceId)?.price ?? ""}/mes`;
  };

  const isSubscriptionDisabled = (planPriceId: string) => {
    if (loading === planPriceId) return true;
    if (plan === planPriceId) return true;
    if (plan === "enterprise") return true;
    return false;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Subscription already active modal */}
      {subscriptionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1">Suscripción activa</h3>
              <p className="text-sm text-gray-600">{subscriptionModal.message}</p>
            </div>
            <div className="space-y-2">
              {subscriptionModal.currentPlan === "pro" && (
                <button
                  onClick={() => { setSubscriptionModal(null); handleSubscribe("enterprise"); }}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Mejorar al Plan Enterprise ↗
                </button>
              )}
              <button
                onClick={() => setSubscriptionModal(null)}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

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
          {(plan === "pro" || plan === "enterprise") && (
            <button
              onClick={handleManageSubscription}
              disabled={portalLoading}
              className="mt-4 text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2 disabled:opacity-50"
            >
              {portalLoading ? "Abriendo portal..." : "Gestionar o cancelar mi suscripción"}
            </button>
          )}
        </div>

        {/* ── Tab toggle ───────────────────────────────────── */}
        <div className="flex justify-center mb-4">
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

        {/* ── Toggle mensual / anual ───────────────────────── */}
        {activeTab === "plans" && (
          <div className="flex justify-center mb-5">
            <div className="inline-flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  billingCycle === "monthly" ? "bg-white shadow text-gray-800" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Mensual
              </button>
              <button
                onClick={() => setBillingCycle("annual")}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                  billingCycle === "annual" ? "bg-white shadow text-green-700" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Anual
                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">-20%</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Planes de suscripción ─────────────────────────── */}
        {activeTab === "plans" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
                    <span className="text-2xl font-extrabold text-gray-900">
                      {billingCycle === "annual" && plan.priceId === "pro" ? "23€"
                        : billingCycle === "annual" && plan.priceId === "enterprise" ? "79€"
                        : plan.price}
                    </span>
                    <span className="ml-1 text-sm text-gray-500">/mes</span>
                  </div>
                  {billingCycle === "annual" && plan.priceId === "pro" && (
                    <p className="text-xs text-green-600 mt-0.5 font-medium">Facturado como 276€/año · Ahorras 72€</p>
                  )}
                  {billingCycle === "annual" && plan.priceId === "enterprise" && (
                    <p className="text-xs text-green-600 mt-0.5 font-medium">Facturado como 948€/año · Ahorras 240€</p>
                  )}
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
                    ) : billingCycle === "annual" && plan.priceIdAnnual ? (
                      <button
                        onClick={() => handleSubscribe(plan.priceIdAnnual!)}
                        disabled={loading === plan.priceIdAnnual}
                        className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          loading === plan.priceIdAnnual
                            ? "bg-green-300 cursor-not-allowed text-white"
                            : "bg-green-600 text-white hover:bg-green-700 hover:scale-105"
                        }`}
                      >
                        {loading === plan.priceIdAnnual ? (
                          <span className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Procesando...
                          </span>
                        ) : (
                          "Contratar plan anual →"
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSubscribe(plan.priceId)}
                        disabled={isSubscriptionDisabled(plan.priceId)}
                        className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          isSubscriptionDisabled(plan.priceId)
                            ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                            : "bg-blue-600 text-white hover:bg-blue-700 hover:scale-105"
                        }`}
                      >
                        {loading === plan.priceId ? (
                          <span className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Procesando...
                          </span>
                        ) : (
                          getSubscriptionButtonLabel(plan.priceId)
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Créditos de uso ──────────────────────────────── */}
        {activeTab === "credits" && (
          <div className="mb-4">
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
                  { action: "Enriquecer con URL/PDF", cost: 0 },
                  { action: "Crear voz de marca", cost: 1 },
                  { action: "Chat con agente IA", cost: 2 },
                  { action: "Generar audio", cost: 2 },
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
          </div>
        )}

        {/* ── Calculadora coste por producto ───────────────── */}
        {activeTab === "plans" && (
          <div className="mt-2 mb-4 bg-indigo-50 rounded-xl p-5 border border-indigo-100">
            <h3 className="text-sm font-semibold text-indigo-900 mb-1 text-center">¿Cuánto te cuesta por producto?</h3>
            <p className="text-xs text-indigo-600 text-center mb-4">Ajusta según cuántos productos gestionas al mes</p>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs text-gray-400 shrink-0">10</span>
              <input
                type="range"
                min={10}
                max={500}
                step={10}
                value={productsPerMonth}
                onChange={(e) => setProductsPerMonth(Number(e.target.value))}
                className="flex-1 accent-indigo-600"
              />
              <span className="text-xs text-gray-400 shrink-0">500</span>
            </div>
            <p className="text-center text-sm font-bold text-indigo-800 mb-4">{productsPerMonth} productos/mes</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white rounded-xl p-3 border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Gratuito</p>
                {productsPerMonth > 10 ? (
                  <p className="text-sm font-semibold text-red-500">Límite 10</p>
                ) : (
                  <p className="text-xl font-extrabold text-gray-800">0€</p>
                )}
                <p className="text-xs text-gray-400">por producto</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-200 ring-1 ring-blue-400">
                <p className="text-xs text-blue-700 font-semibold mb-1">Pro ⭐</p>
                {productsPerMonth > 1500 ? (
                  <p className="text-sm font-semibold text-amber-600">→ Enterprise</p>
                ) : (
                  <p className="text-xl font-extrabold text-blue-800">
                    {((billingCycle === "annual" ? 23 : 29) / productsPerMonth).toFixed(2).replace(".", ",")}€
                  </p>
                )}
                <p className="text-xs text-blue-500">por producto</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Enterprise</p>
                {productsPerMonth > 7000 ? (
                  <p className="text-sm font-semibold text-gray-500">Contáctanos</p>
                ) : (
                  <p className="text-xl font-extrabold text-gray-800">
                    {((billingCycle === "annual" ? 79 : 99) / productsPerMonth).toFixed(2).replace(".", ",")}€
                  </p>
                )}
                <p className="text-xs text-gray-400">por producto</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Trust badges ─────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-center gap-4 py-4 border-t border-b border-gray-100 my-2">
          {[
            { icon: "🔒", text: "Pagos seguros con Stripe" },
            { icon: "🔄", text: "Cancela cuando quieras" },
            { icon: "⚡", text: "Créditos sin caducidad" },
            { icon: "✉️", text: "Soporte en menos de 24h" },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span>{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>

        {/* ── Tabla comparativa ────────────────────────────── */}
        {activeTab === "plans" && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm border border-gray-100 rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Característica</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Gratuito</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-blue-700 uppercase tracking-wide bg-blue-50">Pro ⭐</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {([
                  { label: "Créditos / mes", free: "20", pro: "1.200", ent: "5.000", tip: "Los créditos no caducan y se acumulan mes a mes" },
                  { label: "Productos por subida CSV", free: "50", pro: "200", ent: "Ilimitado", tip: "Número máximo de productos por archivo CSV subido" },
                  { label: "Agente de Copywriting", free: "20 créditos", pro: "✓ Incluido", ent: "✓ Incluido", tip: "Chat IA conversacional para refinar el copy de cada producto con instrucciones específicas" },
                  { label: "Exportar resultados", free: "✓", pro: "✓", ent: "✓", tip: undefined },
                  { label: "API personalizada", free: "—", pro: "—", ent: "✓", tip: "Integra ListWise directamente en tu sistema de gestión de catálogo o ERP" },
                  { label: "Soporte", free: "Email", pro: "Prioritario", ent: "24/7 + account manager", tip: "Pro: respuesta garantizada en menos de 4h · Enterprise: gestor de cuenta dedicado" },
                ] as { label: string; free: string; pro: string; ent: string; tip?: string }[]).map((row) => (
                  <tr key={row.label} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 text-gray-700 text-xs">
                      {row.tip ? (
                        <span className="inline-flex items-center gap-1 group/tip relative">
                          {row.label}
                          <span className="text-gray-300 text-xs cursor-help leading-none">ℹ</span>
                          <span className="pointer-events-none absolute left-0 top-full mt-1.5 z-20 hidden group-hover/tip:block w-52 bg-gray-800 text-white text-xs rounded-lg px-2.5 py-2 shadow-lg leading-snug">
                            {row.tip}
                          </span>
                        </span>
                      ) : row.label}
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs text-gray-500">{row.free}</td>
                    <td className="px-4 py-2.5 text-center text-xs font-medium text-blue-700 bg-blue-50/50">{row.pro}</td>
                    <td className="px-4 py-2.5 text-center text-xs text-gray-500">{row.ent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── FAQ inline ───────────────────────────────────── */}
        <div className="mt-6 mb-2">
          <h2 className="text-base font-semibold text-gray-800 text-center mb-4">Preguntas frecuentes</h2>
          <div className="max-w-2xl mx-auto space-y-2">
            {[
              {
                q: "¿Puedo cancelar en cualquier momento?",
                a: "Sí. La cancelación es inmediata desde tu panel. Mantienes el acceso hasta el fin del período pagado y los créditos no usados se conservan.",
              },
              {
                q: "¿Los créditos caducan?",
                a: "No. Los créditos nunca caducan. Se acumulan con los del mes siguiente y también con los que compres en packs de créditos adicionales.",
              },
              {
                q: "¿Qué diferencia hay entre créditos de suscripción y packs de créditos?",
                a: "Los créditos de suscripción se renuevan cada mes automáticamente. Los packs son pagos únicos sin renovación — ideales si quieres créditos extra puntuales sin cambiar de plan.",
              },
              {
                q: "¿Puedo cambiar de plan Pro a Enterprise?",
                a: "Sí. Puedes mejorar en cualquier momento. El cambio es inmediato y se aplica el crédito proporcional del plan anterior.",
              },
            ].map((item, i) => (
              <details key={i} className="group bg-white border border-gray-100 rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-sm font-medium text-gray-800 hover:bg-gray-50 transition-colors list-none">
                  {item.q}
                  <span className="text-gray-400 text-lg leading-none ml-4 group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                  <p className="text-sm text-gray-600 leading-relaxed">{item.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pb-3 mt-4">
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
