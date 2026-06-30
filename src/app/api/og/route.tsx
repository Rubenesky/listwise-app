import { ImageResponse } from "next/og";

export const runtime = "nodejs";

const PAGES: Record<string, { title: string; sub: string }> = {
  home: {
    title: "Listings que venden más,\ngenerados en segundos",
    sub: "IA para ecommerce · Amazon · Shopify · Etsy · Wallapop",
  },
  pricing: {
    title: "Planes y Precios",
    sub: "Gratis · Pro 23€/mes · Enterprise 79€/mes",
  },
  blog: {
    title: "Blog — ListWise",
    sub: "Guías y recursos para vendedores de ecommerce",
  },
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pageKey = searchParams.get("page") ?? "home";
  const config = PAGES[pageKey] ?? PAGES.home;
  const { title, sub } = config;

  const img = new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 60%, #1e3a8a 100%)",
          padding: "64px 72px",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "auto" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              background: "rgba(255,255,255,0.15)",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
            }}
          >
            ✦
          </div>
          <span style={{ color: "white", fontSize: "28px", fontWeight: 700, letterSpacing: "-0.5px" }}>
            ListWise
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "48px" }}>
          <p
            style={{
              color: "white",
              fontSize: "56px",
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-1px",
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            {title}
          </p>
          <p
            style={{
              color: "rgba(147,197,253,0.9)",
              fontSize: "22px",
              fontWeight: 400,
              margin: 0,
              letterSpacing: "0.2px",
            }}
          >
            {sub}
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          {["Gratis para empezar", "Sin tarjeta de crédito", "100% contenido único"].map((label) => (
            <div
              key={label}
              style={{
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "100px",
                padding: "8px 20px",
                color: "rgba(255,255,255,0.9)",
                fontSize: "15px",
                fontWeight: 500,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
  img.headers.set("Cache-Control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800");
  return img;
}
