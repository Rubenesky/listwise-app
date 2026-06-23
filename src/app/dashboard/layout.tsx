"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

const navigation = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Precios", href: "/pricing" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 fixed w-full z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo + Navegación */}
            <div className="flex items-center">
              <Link href="/dashboard" className="flex items-center">
                <Image
                  src="/logo.png"
                  alt="ListWise"
                  width={160}
                  height={50}
                  className="h-10 w-auto"
                  priority
                />
              </Link>
              <div className="ml-10 flex space-x-4">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      pathname === item.href
                        ? "bg-blue-100 text-blue-700"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {item.name}
                  </Link>
                ))}
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