import Link from "next/link";
import Image from "next/image";
import { posts } from "@/lib/blog/posts";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://listwise.app";

const blogListJsonLd = {
  "@context": "https://schema.org",
  "@type": "Blog",
  name: "Blog de ListWise",
  url: `${BASE_URL}/blog`,
  description: "Guías y recursos para vendedores de ecommerce sobre SEO de producto, Amazon y copywriting con IA.",
  author: { "@type": "Organization", name: "ListWise", url: BASE_URL },
  blogPost: posts.map((p) => ({
    "@type": "BlogPosting",
    headline: p.title,
    description: p.description,
    datePublished: p.publishedAt,
    url: `${BASE_URL}/blog/${p.slug}`,
    author: { "@type": "Organization", name: "ListWise" },
  })),
};

export default function BlogPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(blogListJsonLd).replace(/</g, "\\u003c"),
        }}
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
          <div className="text-center mb-12">
            <span className="inline-block bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4 uppercase tracking-wide">
              Recursos
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Blog de ListWise
            </h1>
            <p className="text-gray-600 max-w-xl mx-auto">
              Guías prácticas para vendedores de ecommerce. SEO de producto, Amazon, bullet points y copywriting con IA.
            </p>
          </div>

          <div className="grid gap-6">
            {posts.map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`} className="group">
                <article className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                      {post.category}
                    </span>
                    <time className="text-xs text-gray-400" dateTime={post.publishedAt}>
                      {new Date(post.publishedAt).toLocaleDateString("es-ES", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </time>
                    <span className="text-xs text-gray-400">{post.readMinutes} min de lectura</span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-gray-600 text-sm leading-relaxed">{post.description}</p>
                  <span className="inline-block mt-4 text-sm text-blue-600 font-medium group-hover:underline">
                    Leer artículo →
                  </span>
                </article>
              </Link>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-12 bg-blue-700 rounded-2xl p-8 text-center">
            <h2 className="text-xl font-bold text-white mb-2">¿Listo para optimizar tu catálogo?</h2>
            <p className="text-blue-100 text-sm mb-5">10 productos gratis, sin tarjeta de crédito.</p>
            <Link
              href="/sign-up"
              className="inline-block px-6 py-3 bg-white text-blue-700 rounded-lg font-semibold text-sm hover:bg-blue-50 transition-colors"
            >
              Empezar gratis →
            </Link>
          </div>
        </div>

        <footer className="bg-white/50 border-t border-gray-200 py-6 mt-8">
          <div className="max-w-4xl mx-auto px-4 text-center text-gray-500 text-sm">
            <p>© 2026 ListWise · <Link href="/" className="hover:text-blue-600">Inicio</Link> · <Link href="/pricing" className="hover:text-blue-600">Precios</Link></p>
          </div>
        </footer>
      </div>
    </>
  );
}
