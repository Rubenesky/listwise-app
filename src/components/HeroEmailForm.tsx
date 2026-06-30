"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function HeroEmailForm() {
  const [email, setEmail] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return;
    router.push(`/sign-up?emailAddress=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto mb-4"
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="tu@email.com"
        aria-label="Tu correo electrónico"
        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        maxLength={254}
      />
      <button
        type="submit"
        className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 hover:scale-105 transition-all whitespace-nowrap"
      >
        Empezar gratis →
      </button>
    </form>
  );
}
