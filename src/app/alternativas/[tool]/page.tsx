import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { CheckCircle, XCircle, MinusCircle } from "lucide-react";
import { tools, getTool } from "@/lib/alternativas/tools";
import { BASE_URL } from "@/lib/config";

export function generateStaticParams() {
  return tools.map((t) => ({ tool: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tool: string }>;
}): Promise<Metadata> {
  const { tool: slug } = await params;
  const tool = getTool(slug);
  if (!tool) return {};
  return {
    title: tool.title,
    description: tool.description,
    openGraph: {
      title: tool.title,
      description: tool.description,
      url: `${BASE_URL}/alternativas/${tool.slug}`,
      type: "article",
      images: [{ url: `${BASE_URL}/api/og?title=${encodeURIComponent(`ListWise vs ${tool.name}`)}&sub=${encodeURIComponent("Comparativa · ListWise")}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: tool.title,
      description: tool.description,
      images: [`${BASE_URL}/api/og?title=${encodeURIComponent(`ListWise vs ${tool.name}`)}&sub=${encodeURIComponent("Comparativa · ListWise")}`],
    },
    alternates: {
      canonical: `${BASE_URL}/alternativas/${tool.slug}`,
    },
  };
}

function CellValue({ value }: { value: string | boolean }) {
  if (value === true) return <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />;
  if (value === false) return <XCircle className="w-4 h-4 text-red-400 mx-auto" />;
  return <span className="text-xs text-gray-700 text-center block">{value}</span>;
}

export default async function AlternativaPage({
  params,
}: {
  params: Promise<{ tool: string }>;
}) {
  const { tool: slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: tool.title,
    description: tool.description,
    url: `${BASE_URL}/alternativas/${tool.slug}`,
    author: { "@type": "Organization", name: "ListWise", url: BASE_URL },
    publisher: {
      "@type": "Organization",
      name: "ListWise",
      url: BASE_URL,
      logo: { "@type": "ImageObject", url: `${BASE_URL}/logo-transparent.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${BASE_URL}/alternativas/${tool.slug}` },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Nav */}
        <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/">
              <Image src="/logo-transparent.png" alt="ListWise" width={140} height={46} className="h-9 w-auto" priority />
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/pricing" className="text-sm text-gray-600 hover:text-blue-600 transition-colors hidden sm:block">
                Precios
              </Link>
              <Link href="/sign-up" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                Empezar gratis →
              </Link>
            </div>
          </div>
        </nav>

        <div className="max-w-4xl mx-auto px-4 py-12">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex items-center gap-2 text-sm text-gray-500">
              <li><Link href="/" className="hover:text-blue-600">Inicio</Link></li>
              <li className="text-gray-300">›</li>
              <li className="text-gray-700">Alternativas</li>
              <li className="text-gray-300">›</li>
              <li className="text-gray-700">{tool.name}</li>
            </ol>
          </nav>

          {/* Header */}
          <header className="mb-10 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold mb-4 uppercase tracking-wide">
              Comparativa
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
              {tool.heroHeadline}
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
              {tool.heroParagraph}
            </p>
          </header>

          {/* Quick comparison badges */}
          <div className="grid grid-cols-2 gap-4 mb-10">
            <div className="bg-white rounded-xl p-5 shadow-sm border-2 border-blue-600">
              <div className="flex items-center gap-2 mb-2">
                <Image src="/logo-transparent.png" alt="ListWise" width={80} height={26} className="h-6 w-auto" />
                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">ListWise</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Especializado en listings de marketplace</p>
              <p className="text-lg font-bold text-gray-900 mt-2">Gratis — 29 €/mes</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold text-gray-800">{tool.name}</span>
                <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{tool.competitorCategory}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{tool.competitorCategory}</p>
              <p className="text-lg font-bold text-gray-900 mt-2">{tool.competitorPrice}</p>
            </div>
          </div>

          {/* Comparison table */}
          <section className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Tabla comparativa</h2>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-gray-600 font-semibold">Funcionalidad</th>
                    <th className="py-3 px-4 text-blue-600 font-semibold text-center">ListWise</th>
                    <th className="py-3 px-4 text-gray-500 font-semibold text-center">{tool.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {tool.comparison.map((row, i) => (
                    <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? "" : "bg-gray-50/50"}`}>
                      <td className="py-3 px-4 text-gray-700 font-medium">{row.feature}</td>
                      <td className="py-3 px-4"><CellValue value={row.listwise} /></td>
                      <td className="py-3 px-4"><CellValue value={row.competitor} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Reasons */}
          <section className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Por qué elegir ListWise frente a {tool.name}</h2>
            <div className="grid gap-5">
              {tool.reasonsToChoose.map((reason, i) => (
                <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-white text-xs font-bold">{i + 1}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 mb-1">{reason.title}</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">{reason.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Verdict */}
          <section className="mb-12">
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <MinusCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-bold text-indigo-900 mb-2">Veredicto final</h2>
                  <p className="text-sm text-indigo-800 leading-relaxed">{tool.verdict}</p>
                </div>
              </div>
            </div>
          </section>

          {/* CTA */}
          <div className="bg-blue-700 rounded-2xl p-8 text-center">
            <h2 className="text-xl font-bold text-white mb-2">
              Prueba ListWise gratis — sin tarjeta de crédito
            </h2>
            <p className="text-blue-100 text-sm mb-5">
              20 créditos gratuitos. Genera tu primer listing en menos de 2 minutos.
            </p>
            <Link
              href="/sign-up"
              className="inline-block px-6 py-3 bg-white text-blue-700 rounded-lg font-semibold text-sm hover:bg-blue-50 transition-colors"
            >
              Empezar gratis →
            </Link>
          </div>

          {/* Other comparisons */}
          <div className="mt-10">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Otras comparativas</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {tools
                .filter((t) => t.slug !== tool.slug)
                .map((other) => (
                  <Link key={other.slug} href={`/alternativas/${other.slug}`} className="group">
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all">
                      <span className="text-xs text-blue-600 font-medium">{other.competitorCategory}</span>
                      <h3 className="font-semibold text-gray-900 mt-1 group-hover:text-blue-600 transition-colors">
                        ListWise vs {other.name}
                      </h3>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        </div>

        <footer className="bg-white/50 border-t border-gray-200 py-6 mt-8">
          <div className="max-w-4xl mx-auto px-4 text-center text-gray-500 text-sm">
            <p>© 2026 ListWise · <Link href="/" className="hover:text-blue-600">Inicio</Link> · <Link href="/blog" className="hover:text-blue-600">Blog</Link> · <Link href="/pricing" className="hover:text-blue-600">Precios</Link></p>
          </div>
        </footer>
      </div>
    </>
  );
}
