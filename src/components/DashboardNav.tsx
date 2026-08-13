"use client";

import { useState, useRef, useEffect } from "react";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useUserPlan } from "@/app/api/user/plan/useUserPlan";

const PLAN_LOGO: Record<string, string> = {
  pro: "/logo-pro.png",
  enterprise: "/logo-enterprise.png",
};

const PLAN_STYLES: Record<string, {
  nav: string;
  linkActive: string;
  linkInactive: string;
  downloadLink: string;
}> = {
  free: {
    nav: "bg-blue-50 border-b border-blue-200",
    linkActive: "bg-blue-100 text-blue-700",
    linkInactive: "text-gray-700 hover:bg-blue-100",
    downloadLink: "text-blue-600 hover:bg-blue-100",
  },
  pro: {
    nav: "bg-amber-50 border-b border-amber-300",
    linkActive: "bg-amber-200 text-amber-900",
    linkInactive: "text-gray-700 hover:bg-amber-100",
    downloadLink: "text-amber-700 hover:bg-amber-100",
  },
  enterprise: {
    nav: "bg-gray-900 border-b border-gray-700",
    linkActive: "bg-gray-700 text-white",
    linkInactive: "text-gray-200 hover:bg-gray-700",
    downloadLink: "text-amber-400 hover:bg-gray-700",
  },
};

// Core, daily-use AI actions — stay inline in the desktop bar.
const primaryNav = [
  { name: "📊 Dashboard", href: "/dashboard", download: false },
  { name: "🤖 Agente", href: "/agent", download: false },
  { name: "🎨 Voz de Marca", href: "/dashboard/voice-profile", download: false },
  { name: "🔍 Competencia", href: "/dashboard/competitor", download: false },
  { name: "🔊 Audio Comercial", href: "/dashboard/audio", download: false },
];

// Growth/utility items — grouped under "Más" on desktop so the bar always
// fits on one line regardless of viewport width, instead of wrapping or
// scrolling.
const moreNav = [
  { name: "🎁 Invitar", href: "/dashboard/referrals", download: false },
  { name: "🏆 Gamificación", href: "/gamification", download: false },
  { name: "🏷️ Precios", href: "/pricing", download: false },
  { name: "❓ Ayuda", href: "/dashboard/help", download: false },
  { name: "Plantilla CSV", href: "/api/template/csv", download: true },
];

// Mobile menu stays a single flat list — it already stacks vertically, so
// the width problem the "Más" dropdown solves doesn't apply there.
const navigation = [...primaryNav, ...moreNav];

export default function DashboardNav() {
  const pathname = usePathname();
  const { plan } = useUserPlan();
  const logoSrc = PLAN_LOGO[plan] ?? "/logo.png";
  const styles = PLAN_STYLES[plan] ?? PLAN_STYLES.free;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [moreOpen]);

  const isMoreActive = moreNav.some((item) => pathname === item.href);

  return (
    <nav className={`${styles.nav} fixed w-full z-10`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="flex items-center">
              <Image src={logoSrc} alt="ListWise" width={160} height={50} className="h-10 w-auto" priority />
            </Link>
            <div className="hidden md:flex ml-6 items-center space-x-1">
              {primaryNav.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`px-2.5 py-2 rounded-md text-sm font-medium whitespace-nowrap shrink-0 ${
                    pathname === item.href ? styles.linkActive : styles.linkInactive
                  }`}
                >
                  {item.name}
                </Link>
              ))}

              <div className="relative" ref={moreRef}>
                <button
                  onClick={() => setMoreOpen((o) => !o)}
                  className={`px-2.5 py-2 rounded-md text-sm font-medium whitespace-nowrap shrink-0 flex items-center gap-1 ${
                    isMoreActive ? styles.linkActive : styles.linkInactive
                  }`}
                >
                  Más
                  <svg className={`w-3.5 h-3.5 transition-transform ${moreOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {moreOpen && (
                  <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-20">
                    {moreNav.map((item) =>
                      item.download ? (
                        <a
                          key={item.name}
                          href={item.href}
                          download
                          onClick={() => setMoreOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          {item.name}
                        </a>
                      ) : (
                        <Link
                          key={item.name}
                          href={item.href}
                          onClick={() => setMoreOpen(false)}
                          className={`block px-3 py-2 text-sm font-medium ${
                            pathname === item.href ? "text-blue-700 bg-blue-50" : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {item.name}
                        </Link>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen((o) => !o)}
              className="md:hidden p-2 rounded-lg transition-colors"
              aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
            >
              {mobileOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-gray-200/60 py-2 pb-3 space-y-0.5">
            {navigation.map((item) =>
              item.download ? (
                <a
                  key={item.name}
                  href={item.href}
                  download
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium w-full ${styles.downloadLink}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {item.name}
                </a>
              ) : (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center px-3 py-2.5 rounded-md text-sm font-medium ${
                    pathname === item.href ? styles.linkActive : styles.linkInactive
                  }`}
                >
                  {item.name}
                </Link>
              )
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
