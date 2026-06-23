"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.push("/dashboard");
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <div className="text-center">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Image
              src="/logo-transparent.png"
              alt="ListWise"
              width={300}
              height={100}
              className="h-28 w-auto drop-shadow-xl"
              priority
            />
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            Genera descripciones de productos con IA
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 max-w-2xl mx-auto mb-8">
            Ahorra horas de trabajo y aumenta tus ventas con descripciones optimizadas para SEO y conversión.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link
              href="/sign-up"
              className="px-8 py-4 bg-blue-600 text-white rounded-lg font-medium text-lg hover:bg-blue-700 transition-colors"
            >
              Crear cuenta gratuita
            </Link>
            <Link
              href="/pricing"
              className="px-8 py-4 bg-white text-blue-600 rounded-lg font-medium text-lg border-2 border-blue-600 hover:bg-blue-50 transition-colors"
            >
              Ver precios
            </Link>
          </div>

          <p className="text-sm text-gray-500 mb-12">
            Prueba gratis con 10 productos. Sin tarjeta de crédito.
          </p>
        </div>

        {/* Cómo funciona */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 md:p-12 shadow-xl mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-12">
            Cómo funciona ListWise
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">1</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Sube tu CSV</h3>
              <p className="text-gray-600">
                Descarga la plantilla y sube tu catálogo de productos en formato CSV.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">2</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Genera descripciones</h3>
              <p className="text-gray-600">
                Nuestra IA genera títulos SEO, bullets de beneficios y descripciones emocionales.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">3</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Edita y publica</h3>
              <p className="text-gray-600">
                Revisa, edita y exporta las descripciones optimizadas para tu tienda online.
              </p>
            </div>
          </div>
        </div>

        {/* Características */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-md text-center">
            <div className="text-3xl mb-3">🤖</div>
            <h3 className="font-semibold text-gray-900">IA Avanzada</h3>
            <p className="text-sm text-gray-600">Descripciones únicas y optimizadas para conversión.</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-md text-center">
            <div className="text-3xl mb-3">⚡</div>
            <h3 className="font-semibold text-gray-900">Rápido y Eficiente</h3>
            <p className="text-sm text-gray-600">Procesa cientos de productos en minutos.</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-md text-center">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="font-semibold text-gray-900">SEO Optimizado</h3>
            <p className="text-sm text-gray-600">Títulos y descripciones pensados para posicionar.</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-md text-center">
            <div className="text-3xl mb-3">🎨</div>
            <h3 className="font-semibold text-gray-900">Fácil de Usar</h3>
            <p className="text-sm text-gray-600">Sin curva de aprendizaje. Sube tu CSV y ya está.</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white/50 border-t border-gray-200 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-gray-600 text-sm">
          <p>© 2026 ListWise. Todos los derechos reservados.</p>
          <div className="flex justify-center gap-6 mt-2">
            <Link href="/pricing" className="hover:text-blue-600">Precios</Link>
            <Link href="/dashboard" className="hover:text-blue-600">Dashboard</Link>
            <a href="mailto:contacto@listwise.com" className="hover:text-blue-600">Contacto</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
