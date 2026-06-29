import type { Metadata } from "next";
import DashboardLayout from "@/app/dashboard/layout";

export const metadata: Metadata = {
  title: "Agente de Copywriting IA",
  description:
    "Refina y mejora tus listings con el Agente de Copywriting de ListWise. Instrucciones en lenguaje natural para ajustar tono, keywords, marketplace y estilo de escritura.",
};

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
