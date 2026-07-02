import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { posts, getPost } from "@/lib/blog/posts";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://listwise.app";

export function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      url: `${BASE_URL}/blog/${post.slug}`,
      type: "article",
      publishedTime: post.publishedAt,
      images: [{ url: `${BASE_URL}/api/og?title=${encodeURIComponent(post.title.slice(0, 80))}&sub=${encodeURIComponent(`${post.category} · ListWise Blog`)}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [`${BASE_URL}/api/og?title=${encodeURIComponent(post.title.slice(0, 80))}&sub=${encodeURIComponent(`${post.category} · ListWise Blog`)}`],
    },
    alternates: {
      canonical: `${BASE_URL}/blog/${post.slug}`,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    url: `${BASE_URL}/blog/${post.slug}`,
    author: {
      "@type": "Organization",
      name: "ListWise",
      url: BASE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "ListWise",
      url: BASE_URL,
      logo: { "@type": "ImageObject", url: `${BASE_URL}/logo-transparent.png` },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${BASE_URL}/blog/${post.slug}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleJsonLd).replace(/</g, "\\u003c"),
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
              <Link href="/blog" className="text-sm text-gray-600 hover:text-blue-600 transition-colors hidden sm:block">
                Blog
              </Link>
              <Link href="/sign-up" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                Empezar gratis →
              </Link>
            </div>
          </div>
        </nav>

        <div className="max-w-3xl mx-auto px-4 py-12">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex items-center gap-2 text-sm text-gray-500">
              <li><Link href="/" className="hover:text-blue-600">Inicio</Link></li>
              <li className="text-gray-300">›</li>
              <li><Link href="/blog" className="hover:text-blue-600">Blog</Link></li>
              <li className="text-gray-300">›</li>
              <li className="text-gray-700 truncate max-w-[200px]">{post.title}</li>
            </ol>
          </nav>

          <article>
            <header className="mb-8">
              <div className="flex items-center gap-3 mb-4">
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
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-4">
                {post.title}
              </h1>
              <p className="text-lg text-gray-600 leading-relaxed">{post.description}</p>
            </header>

            <div
              className="prose prose-blue prose-lg max-w-none bg-white rounded-2xl p-8 shadow-sm
                prose-h2:text-2xl prose-h2:font-bold prose-h2:text-gray-900 prose-h2:mt-8 prose-h2:mb-4
                prose-p:text-gray-600 prose-p:leading-relaxed
                prose-ul:text-gray-600 prose-ol:text-gray-600
                prose-li:my-1
                prose-strong:text-gray-800
                prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          </article>

          {/* CTA inside article */}
          <div className="mt-10 bg-blue-700 rounded-2xl p-8 text-center">
            <h2 className="text-xl font-bold text-white mb-2">
              Genera tus listings con IA ahora mismo
            </h2>
            <p className="text-blue-100 text-sm mb-5">
              20 créditos gratis, sin tarjeta de crédito. Resultado en menos de 2 minutos.
            </p>
            <Link
              href="/sign-up"
              className="inline-block px-6 py-3 bg-white text-blue-700 rounded-lg font-semibold text-sm hover:bg-blue-50 transition-colors"
            >
              Empezar gratis →
            </Link>
          </div>

          {/* Other articles */}
          <div className="mt-10">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Más artículos</h2>
            <div className="grid gap-4">
              {posts
                .filter((p) => p.slug !== post.slug)
                .map((related) => (
                  <Link key={related.slug} href={`/blog/${related.slug}`} className="group">
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all">
                      <span className="text-xs text-blue-600 font-medium">{related.category}</span>
                      <h3 className="font-semibold text-gray-900 mt-1 group-hover:text-blue-600 transition-colors">
                        {related.title}
                      </h3>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        </div>

        <footer className="bg-white/50 border-t border-gray-200 py-6 mt-8">
          <div className="max-w-3xl mx-auto px-4 text-center text-gray-500 text-sm">
            <p>© 2026 ListWise · <Link href="/" className="hover:text-blue-600">Inicio</Link> · <Link href="/blog" className="hover:text-blue-600">Blog</Link> · <Link href="/pricing" className="hover:text-blue-600">Precios</Link></p>
          </div>
        </footer>
      </div>
    </>
  );
}
