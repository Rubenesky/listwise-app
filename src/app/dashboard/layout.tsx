import DashboardNav from "@/components/DashboardNav";
import GamificationToast from "@/components/GamificationToast";
import VersionFooter from "@/components/VersionFooter";

export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav />
      <main className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <VersionFooter />
      <GamificationToast />
    </div>
  );
}
