import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await isAdmin();
  if (!admin) redirect("/dashboard");
  return <>{children}</>;
}
