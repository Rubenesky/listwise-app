import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://listwise-app.onrender.com";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id")?.trim();
    if (!id || id.length > 36) {
      return new Response("Enlace inválido.", { status: 400, headers: { "Content-Type": "text/plain" } });
    }

    await db.update(schema.leads).set({ unsubscribed: 1 }).where(eq(schema.leads.id, id));

    return new Response(
      `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Baja confirmada — ListWise</title></head><body style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:80px auto;padding:0 24px;text-align:center;"><div style="font-size:48px;margin-bottom:16px;">&#x2705;</div><h1 style="font-size:24px;font-weight:700;color:#111827;margin-bottom:8px;">Baja confirmada</h1><p style="color:#6b7280;font-size:15px;line-height:1.6;margin-bottom:32px;">Ya no recibir&#xE1;s m&#xE1;s emails de ListWise relacionados con esta suscripci&#xF3;n.</p><a href="${appUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Volver a ListWise</a></body></html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch {
    return new Response("Error al procesar la baja.", { status: 500, headers: { "Content-Type": "text/plain" } });
  }
}
