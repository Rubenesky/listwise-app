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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-3xl w-full text-center">
        {/* Logo grande */}
        <div className="flex justify-center mb-8">
          <Image
            src="/logo-transparent.png"
            alt="ListWise"
            width={320}
            height={100}
            className="h-24 w-auto drop-shadow-xl"
            priority
          />
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          Genera descripciones de productos con IA
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Ahorra horas de trabajo y aumenta tus ventas con descripciones optimizadas para SEO y conversión.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/sign-in"
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/sign-up"
            className="px-8 py-3 bg-white text-blue-600 rounded-lg font-medium border border-blue-600 hover:bg-blue-50 transition-colors"
          >
            Crear cuenta gratuita
          </Link>
        </div>

        <p className="mt-8 text-sm text-gray-500">
          Prueba gratis con 10 productos. Sin tarjeta de crédito.
        </p>
      </div>
    </div>
  );
}