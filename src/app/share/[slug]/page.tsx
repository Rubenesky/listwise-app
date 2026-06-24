import { notFound } from "next/navigation";
import { Metadata } from "next";
import Image from "next/image";
import { Eye } from "lucide-react";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import ShareButtons from "@/components/ShareButtons";
import ViewTracker from "@/components/ViewTracker";

export const revalidate = 60; // ISR: revalidate every minute

async function getListing(slug: string) {
  const [listing] = await db
    .select()
    .from(schema.listings)
    .where(eq(schema.listings.slug, slug))
    .limit(1);
  return listing ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListing(slug);

  if (!listing) {
    return { title: "Producto no encontrado — ListWise" };
  }

  const title = listing.generatedTitle ?? listing.productName;
  const bullets = (listing.generatedBullets as string[] | null) ?? [];
  const description = listing.generatedDescription
    ? listing.generatedDescription.slice(0, 160)
    : bullets.slice(0, 2).join(" | ").slice(0, 160);

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/share/${slug}`;

  return {
    title: `${title} — ListWise`,
    description,
    openGraph: {
      title,
      description,
      url: shareUrl,
      siteName: "ListWise",
      images: [{ url: `${process.env.NEXT_PUBLIC_APP_URL}/logo.png`, width: 400, height: 400 }],
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await getListing(slug);

  if (!listing) {
    notFound();
  }

  const title = listing.generatedTitle ?? listing.productName;
  const bullets = (listing.generatedBullets as string[] | null) ?? [];
  const description = listing.generatedDescription ?? "";
  const shareCount = listing.shareCount ?? 0;
  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/share/${slug}`;

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);

  const shareLinks = {
    whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    email: `mailto:?subject=${encodedTitle}&body=Mira este producto en ListWise: ${encodedUrl}`,
  };

  return (
    <>
      <ViewTracker slug={slug} />

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 py-4">
          <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
            <Image src="/logo-transparent.png" alt="ListWise" width={120} height={32} />
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <Eye className="h-4 w-4" />
              <span>{shareCount.toLocaleString("es")} visitas</span>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="max-w-4xl mx-auto px-4 py-10">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Product title */}
            <div className="p-8 border-b border-gray-100">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-2">
                {listing.productName}
              </p>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-snug">
                {title}
              </h1>
            </div>

            {/* Bullets */}
            {bullets.length > 0 && (
              <div className="p-8 border-b border-gray-100">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">
                  Características
                </h2>
                <ul className="space-y-3">
                  {bullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex-shrink-0 mt-1 w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-bold">
                        {i + 1}
                      </span>
                      <span className="text-gray-700 leading-relaxed">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Description */}
            {description && (
              <div className="p-8 border-b border-gray-100">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">
                  Descripción completa
                </h2>
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">{description}</p>
              </div>
            )}

            {/* Share section */}
            <div className="p-8 bg-gray-50">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">
                Compartir este producto
              </h2>
              <ShareButtons shareUrl={shareUrl} shareLinks={shareLinks} />
            </div>
          </div>

          {/* CTA */}
          <div className="mt-8 text-center">
            <p className="text-gray-500 text-sm mb-3">
              Contenido generado con IA por{" "}
              <span className="font-semibold text-gray-700">ListWise</span>
            </p>
            <a
              href={`${process.env.NEXT_PUBLIC_APP_URL}/pricing`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              Crear mi cuenta gratis →
            </a>
          </div>
        </main>
      </div>
    </>
  );
}
