import { auth } from "@clerk/nextjs/server";
import PricingPageClient from "./PricingPageClient";

export const metadata = {
  title: "Precios — ListWise",
  description: "Elige el plan de ListWise que mejor se adapta a tu negocio. Planes desde 0€ con créditos de IA para generar descripciones de productos.",
};

export default async function PricingPage() {
  const { userId } = await auth();
  return <PricingPageClient isSignedIn={!!userId} />;
}
