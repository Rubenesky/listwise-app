"use client";

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

const navigation = [
  { name: "Dashboard", href: "/dashboard", download: false },
  { name: "🤖 Agente", href: "/agent", download: false },
  { name: "🔍 Competencia", href: "/dashboard/competitor", download: false },
  { name: "🎁 Invitar", href: "/dashboard/referrals", download: false },
  { name: "🏆 Gamificación", href: "/gamification", download: false },
  { name: "Precios", href: "/pricing", download: false },
  { name: "Plantilla CSV", href: "/api/template/csv", download: true },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { plan } = useUserPlan();
  const logoSrc = PLAN_LOGO[plan] ?? "/logo.png";
  const styles = PLAN_STYLES[plan] ?? PLAN_STYLES.free;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className={`${styles.nav} fixed w-full z-10`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo + Navegación */}
            <div className="flex items-center">
              <Link href="/dashboard" className="flex items-center">
                <Image
                  src={logoSrc}
                  alt="ListWise"
                  width={160}
                  height={50}
                  className="h-10 w-auto"
                  priority
                />
              </Link>
              <div className="ml-10 flex space-x-4">
                {navigation.map((item) =>
                  item.download ? (
                    <a
                      key={item.name}
                      href={item.href}
                      download
                      className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1 ${styles.downloadLink}`}
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
                      className={`px-3 py-2 rounded-md text-sm font-medium ${
                        pathname === item.href
                          ? styles.linkActive
                          : styles.linkInactive
                      }`}
                    >
                      {item.name}
                    </Link>
                  )
                )}
              </div>
            </div>

            {/* User Button */}
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </nav>

      {/* Contenido principal */}
      <main className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}