import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq, and, sql } from "drizzle-orm";
import { providers, getDefaultProvider } from "@/lib/ai/providers";
import { ratelimitAgentMinute, ratelimitAgentHour } from "@/lib/rate-limit";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { AGENT_SYSTEM_PROMPT } from "@/lib/ai/agent-prompts";
import { trackGamification } from "@/lib/gamification/track";
import { ensureUser } from "@/lib/user/ensure-user";

const requestSchema = z.object({
  message: z.string().min(1).max(500),
  listingId: z.string().min(1),
  conversationId: z.string().nullable().optional(),
  command: z.string().optional(),
});

const SPEC_PATTERNS: RegExp[] = [
  /\bIPX?\d+\b/gi,
  /garantía\s+(?:de\s+)?\d+\s*año/gi,
  /\bISO\s+\d+/gi,
  /\bRoHS\b/gi,
  /\bFDA\b/gi,
  /\bECOCERT\b/gi,
  /\bCOSMOS\s+Organic\b/gi,
  /\bUIAA\b/gi,
  /certificación\s+[A-Z]{2,}\d*/gi,
];

function detectInventedSpecs(parsedResponse: Record<string, unknown>, attributes: unknown): string[] {
  const bullets = Array.isArray(parsedResponse.updatedBullets)
    ? (parsedResponse.updatedBullets as string[]).join(" ")
    : "";
  const description = typeof parsedResponse.updatedDescription === "string"
    ? parsedResponse.updatedDescription : "";
  const generated = (bullets + " " + description).toLowerCase();
  const attrStr = JSON.stringify(attributes ?? "").toLowerCase();
  const invented: string[] = [];
  for (const pattern of SPEC_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = re.exec(generated)) !== null) {
      const spec = match[0].replace(/\s+/g, " ").trim().toLowerCase();
      if (!attrStr.includes(spec)) invented.push(match[0]);
    }
  }
  return [...new Set(invented)];
}

function detectCommand(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("acort") || lower.includes("resum")) return "acortar";
  if (lower.includes("juvenil") || lower.includes("joven")) return "juvenil";
  if (lower.includes("formal") || lower.includes("profesional")) return "formal";
  if (lower.includes("seo") || lower.includes("keyword") || lower.includes("palabra clave")) return "seo";
  if (lower.includes("emotivo") || lower.includes("emocion")) return "emocional";
  if (lower.includes("tecnic") || lower.includes("especificacion")) return "tecnico";
  return "general";
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      console.log("❌ [Agent] Intento sin autenticación");
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const parsedBody = requestSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: "Datos inválidos", details: parsedBody.error.errors }, { status: 400 });
    }
    const { message, listingId, conversationId, command } = parsedBody.data;

    console.log(`🤖 [Agent] Usuario ${userId} - Mensaje: ${message.slice(0, 80)}`);

    // Rate limit per minute (all users)
    const { success: minuteOk } = await ratelimitAgentMinute.limit(`agent:${userId}`);
    if (!minuteOk) {
      console.log(`❌ [Agent] Rate limit minuto excedido para ${userId}`);
      return NextResponse.json({ error: "Demasiadas consultas. Espera un momento." }, { status: 429 });
    }

    // Ensure user row exists with free-tier defaults (new user path)
    await ensureUser(userId);

    // Fetch user info
    const [user] = await db
      .select({ agentCredits: schema.users.agentCredits, agentPlan: schema.users.agentPlan })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    const agentPlan = user?.agentPlan ?? "free";
    const isFree = agentPlan === "free";
    const credits = user?.agentCredits ?? 0;

    // Rate limit per hour (free users only)
    if (isFree) {
      const { success: hourOk } = await ratelimitAgentHour.limit(`agent:${userId}:hour`);
      if (!hourOk) {
        console.log(`❌ [Agent] Rate limit hora excedido para ${userId}`);
        return NextResponse.json({ error: "Has alcanzado el límite de consultas por hora." }, { status: 429 });
      }
    }

    // Check credits (free users only)
    if (isFree && credits <= 0) {
      console.log(`❌ [Agent] Usuario ${userId} sin créditos`);
      return NextResponse.json({
        error: "Sin créditos",
        upsell: true,
        message: "Has agotado tus consultas gratuitas. Compra más consultas o actualiza a Pro.",
        plans: [
          { name: "20 consultas", price: 0.99 },
          { name: "50 consultas", price: 1.99 },
          { name: "100 consultas", price: 2.99 },
          { name: "Plan Pro", price: 29 },
        ],
      }, { status: 403 });
    }

    // Verify listing ownership
    const [listing] = await db
      .select()
      .from(schema.listings)
      .where(and(eq(schema.listings.id, listingId), eq(schema.listings.userId, userId)))
      .limit(1);

    if (!listing) {
      console.log(`❌ [Agent] Producto ${listingId} no encontrado`);
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    // Load conversation history
    let conversation: { id: string; messages: unknown } | null = null;
    if (conversationId) {
      const [conv] = await db
        .select()
        .from(schema.agentConversations)
        .where(and(eq(schema.agentConversations.id, conversationId), eq(schema.agentConversations.userId, userId)))
        .limit(1);
      if (conv) conversation = conv;
    }

    const messages: { role: string; content: string }[] = Array.isArray(conversation?.messages)
      ? (conversation.messages as { role: string; content: string }[])
      : [];
    messages.push({ role: "user", content: message });

    // Build system prompt with product context
    const bullets = (listing.generatedBullets as string[] | null) ?? [];
    const systemPrompt = AGENT_SYSTEM_PROMPT
      .replace("{productName}", listing.productName)
      .replace("{category}", listing.category ?? "General")
      .replace("{attributes}", JSON.stringify(listing.attributes ?? {}))
      .replace("{currentTitle}", listing.generatedTitle ?? "")
      .replace("{currentBullets}", bullets.join("\n"))
      .replace("{currentDescription}", listing.generatedDescription ?? "");

    const detectedCommand = command ?? detectCommand(message);
    const startTime = Date.now();
    const newConvId = uuidv4();

    // Call AI provider with streaming
    const aiProvider = getDefaultProvider();
    const aiConfig = providers[aiProvider];
    console.log(`🤖 [Agent] Usando proveedor: ${aiProvider} (${aiConfig.defaultModel})`);
    const stream = await aiConfig.client.chat.completions.create({
      model: aiConfig.defaultModel,
      messages: [{ role: "system", content: systemPrompt }, ...messages] as never,
      temperature: 0.7,
      max_tokens: 1024,
      stream: true,
      response_format: { type: "json_object" },
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let fullResponse = "";
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content ?? "";
            if (content) {
              fullResponse += content;
              // Send chunk so client can show typing indicator
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: content })}\n\n`));
            }
          }

          // Parse complete JSON response
          let parsedResponse: Record<string, unknown> = {};
          try {
            parsedResponse = JSON.parse(fullResponse);
          } catch {
            parsedResponse = { message: "Respuesta procesada.", updatedDescription: fullResponse };
          }

          // Detect specs that may have been fabricated (not present in original attributes)
          const inventedSpecs = detectInventedSpecs(parsedResponse, listing.attributes);
          if (inventedSpecs.length > 0) {
            parsedResponse._inventedSpecs = inventedSpecs;
            console.warn(`⚠️ [Agent] Posibles specs inventadas: ${inventedSpecs.join(", ")}`);
          }

          const latency = Date.now() - startTime;

          // Record analytics
          await db.insert(schema.agentAnalytics).values({
            id: uuidv4(),
            userId,
            listingId,
            command: detectedCommand,
            prompt: message,
            response: fullResponse.slice(0, 2000),
            accepted: 0,
            latency,
            createdAt: Math.floor(Date.now() / 1000),
          });

          // Save or update conversation
          messages.push({ role: "assistant", content: fullResponse });
          const now = Math.floor(Date.now() / 1000);
          if (conversation) {
            await db.update(schema.agentConversations)
              .set({ messages: messages, updatedAt: now })
              .where(eq(schema.agentConversations.id, conversation.id));
          } else {
            await db.insert(schema.agentConversations).values({
              id: newConvId,
              userId,
              listingId,
              messages: messages,
              createdAt: now,
              updatedAt: now,
            });
          }

          // Atomic credit decrement (all plans tracked; free users were already gated above)
          await db.update(schema.users)
            .set({ agentCredits: sql`agent_credits - 1` })
            .where(eq(schema.users.id, userId));
          await db.insert(schema.creditTransactions).values({
            id: uuidv4(), userId, amount: -1, type: "usage",
            description: "Consulta agente IA", stripeRef: null,
            createdAt: Math.floor(Date.now() / 1000),
          });

          trackGamification(userId, "agent_chat").catch(() => {});

          const remainingCredits = Math.max(0, credits - 1);
          const finalConvId = conversation?.id ?? newConvId;

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            done: true,
            parsed: parsedResponse,
            conversationId: finalConvId,
            remainingCredits,
            isFree,
          })}\n\n`));

          console.log(`✅ [Agent] ${latency}ms, comando: ${detectedCommand}, créditos restantes: ${remainingCredits}`);
          controller.close();
        } catch (error) {
          console.error("❌ [Agent] Error en streaming:", error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Error al procesar la respuesta" })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("❌ [Agent] Error general:", error);
    return NextResponse.json({ error: "Error al procesar la consulta" }, { status: 500 });
  }
}
