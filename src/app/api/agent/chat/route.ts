import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { providers, getDefaultProvider } from "@/lib/ai/providers";
import { ratelimitAgentMinute, ratelimitAgentHour } from "@/lib/rate-limit";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { AGENT_SYSTEM_PROMPT } from "@/lib/ai/agent-prompts";
import { trackGamification } from "@/lib/gamification/track";
import { ensureUser } from "@/lib/user/ensure-user";
import { useCredits, addCredits } from "@/lib/credits/use-credits";
import { log } from "@/lib/logger";

const requestSchema = z.object({
  message: z.string().min(1).max(500),
  listingId: z.string().min(1),
  conversationId: z.string().nullable().optional(),
  command: z.string().optional(),
  marketplace: z.enum(["generico", "amazon_es", "etsy", "shopify", "wallapop"]).optional().default("generico"),
  supplementalAttrs: z.record(z.string()).optional().default({}),
  // Set by AgentChat.tsx's runAutoIterate() loop — signals this turn is part of a
  // flat-fee auto-optimize run (see /api/agent/auto-iterate) so this endpoint
  // must NOT deduct the normal per-turn charge on top of that flat fee.
  source: z.literal("auto_iterate").optional(),
});

const FORMAL_TRIGGER_RE = /formal|profesional|corporativo/i;

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
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const parsedBody = requestSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: "Datos inválidos", details: parsedBody.error.errors }, { status: 400 });
    }
    const { message, listingId, conversationId, command, marketplace, supplementalAttrs, source } = parsedBody.data;
    const isAutoIterate = source === "auto_iterate";

    log.info({ userId, messagePreview: message.slice(0, 80) }, "Agent request received");

    // Rate limit per minute (all users)
    const { success: minuteOk } = await ratelimitAgentMinute.limit(`agent:${userId}`);
    if (!minuteOk) {
      log.warn({ userId }, "Agent rate limit (minute) exceeded");
      return NextResponse.json({ error: "Demasiadas consultas. Espera un momento." }, { status: 429 });
    }

    // Ensure user row exists with free-tier defaults (new user path)
    await ensureUser(userId);

    // Fetch user info (plan only — credits are managed atomically by useCredits below)
    const [user] = await db
      .select({ agentPlan: schema.users.agentPlan })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    const agentPlan = user?.agentPlan ?? "free";
    const isFree = agentPlan === "free";

    // Rate limit per hour (free users only)
    if (isFree) {
      const { success: hourOk } = await ratelimitAgentHour.limit(`agent:${userId}:hour`);
      if (!hourOk) {
        log.warn({ userId }, "Agent rate limit (hour) exceeded");
        return NextResponse.json({ error: "Has alcanzado el límite de consultas por hora." }, { status: 429 });
      }
    }

    // Run all independent DB reads in parallel — 4 roundtrips → 1
    const [listingRows, convRows, voiceProfileRows, competitorRows] = await Promise.all([
      db.select()
        .from(schema.listings)
        .where(and(eq(schema.listings.id, listingId), eq(schema.listings.userId, userId)))
        .limit(1),
      conversationId
        ? db.select()
            .from(schema.agentConversations)
            .where(and(eq(schema.agentConversations.id, conversationId), eq(schema.agentConversations.userId, userId)))
            .limit(1)
        : Promise.resolve([]),
      db.select({ profile: schema.voiceProfiles.profile, name: schema.voiceProfiles.name })
        .from(schema.voiceProfiles)
        .where(and(eq(schema.voiceProfiles.userId, userId), eq(schema.voiceProfiles.isActive, 1)))
        .limit(1),
      db.select({ scrapedTitle: schema.competitorAnalyses.scrapedTitle, scrapedKeywords: schema.competitorAnalyses.scrapedKeywords })
        .from(schema.competitorAnalyses)
        .where(and(eq(schema.competitorAnalyses.listingId, listingId), eq(schema.competitorAnalyses.status, "COMPLETED")))
        .limit(3),
    ]);

    const [listing] = listingRows;
    if (!listing) {
      log.warn({ userId, listingId }, "Listing not found");
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const conversation: { id: string; messages: unknown } | null = convRows.length > 0 ? (convRows[0] as { id: string; messages: unknown }) : null;
    const [voiceProfile] = voiceProfileRows as { profile: unknown; name: string }[];
    const competitors = competitorRows as { scrapedTitle: string | null; scrapedKeywords: unknown }[];

    const messages: { role: string; content: string; timestamp?: number }[] = Array.isArray(conversation?.messages)
      ? (conversation.messages as { role: string; content: string; timestamp?: number }[])
      : [];
    messages.push({ role: "user", content: message, timestamp: Math.floor(Date.now() / 1000) });

    // Build category-specific copywriting context
    const cat = (listing.category ?? "").toLowerCase();
    const categoryRules: Array<[RegExp, string]> = [
      [/ropa|moda|fashion|sudadera|camiseta|vestido|pantalón|chaqueta|abrigo|jersey|camisa|blusa|falda|shorts|vaquero|denim|tejido|prenda/i,
        `\n═══════════════════════════════════════════\nCATEGORÍA: Moda y Ropa\n- El primer bullet debe evocar la silueta o sensación de llevar la prenda\n- Incluye combinaciones de outfits concretas (con qué prendas combina)\n- Menciona cuidado de la prenda si está en los atributos\n- Evita tecnicismos de costura; usa lenguaje de estilo de vida\n- La descripción debe anclar la prenda en un momento de uso real\nOBJECIONES A ANTICIPAR (responde al menos una en bullets o descripción):\n• "¿Encoge al lavar?" → menciona cuidado o composición estable si está en atributos\n• "¿El oversized es realmente grande o es talla normal?" → aclara el corte con medida o comparativa\n• "¿Hace bolitas con el uso?" → menciona calidad del tejido si aplica\n═══════════════════════════════════════════\n`],
      [/electrónica|electrónico|auricular|altavoz|móvil|tablet|portátil|ordenador|cámara|gadget|tech|smart|bluetooth|wireless/i,
        `\n═══════════════════════════════════════════\nCATEGORÍA: Electrónica y Tecnología\n- El primer bullet debe incluir la especificación técnica más diferenciadora\n- Formato para specs: DATO TÉCNICO: cifra + unidad → beneficio concreto\n- Menciona compatibilidad (iOS/Android, USB-C, etc.) si está en atributos\n- Incluye escenario de uso real (trabajo, viaje, deporte)\n- Evita superlativos sin datos: no "la mejor calidad", sí "batería 30h"\nOBJECIONES A ANTICIPAR:\n• "¿Funciona con mi dispositivo?" → menciona compatibilidad si está en atributos\n• "¿La batería dura de verdad lo que dice?" → usa la cifra exacta de los atributos\n• "¿Es fácil de configurar?" → menciona setup si aplica\n═══════════════════════════════════════════\n`],
      [/hogar|cocina|decoración|mueble|sillón|sofá|lámpara|cojín|alfombra|jardín|baño|dormitorio|sala|comedor/i,
        `\n═══════════════════════════════════════════\nCATEGORÍA: Hogar y Decoración\n- Incluye dimensiones exactas si están en los atributos\n- Menciona el estilo decorativo (nórdico, industrial, mediterráneo, minimalista)\n- Conecta el producto con la sensación del espacio (amplitud, calidez, orden)\n- El primer bullet debe vincular el producto con la habitación o uso específico\n- Menciona material y acabado de forma concreta\nOBJECIONES A ANTICIPAR:\n• "¿Cabrá en mi espacio?" → incluye dimensiones si están disponibles\n• "¿Combina con lo que ya tengo?" → menciona estilo y colores neutros/versátiles\n• "¿Es fácil de montar/limpiar?" → menciona si aplica\n═══════════════════════════════════════════\n`],
      [/deporte|fitness|running|yoga|gym|entrenamiento|ciclismo|natación|hiking|senderismo|outdoor|deportivo/i,
        `\n═══════════════════════════════════════════\nCATEGORÍA: Deporte y Fitness\n- El primer bullet debe nombrar la actividad principal y el beneficio de rendimiento\n- Incluye datos de material técnico (transpirabilidad, compresión, protección UV)\n- Menciona condiciones de uso (lluvia, calor, interior/exterior)\n- Usa verbos de acción y logro: "aguanta", "protege", "mejora", "resiste"\n- Evita lenguaje de lifestyle genérico; habla de rendimiento específico\nOBJECIONES A ANTICIPAR:\n• "¿Aguanta el sudor/lluvia sin deformarse?" → menciona material y propiedades\n• "¿La talla es fiel?" → aclara si el tallaje es estándar o específico\n• "¿Sirve para [actividad concreta]?" → menciona los usos explícitamente\n═══════════════════════════════════════════\n`],
      [/alimentación|alimento|comida|bebida|snack|suplemento|proteína|vitamina|ecológico|orgánico|gourmet/i,
        `\n═══════════════════════════════════════════\nCATEGORÍA: Alimentación\n- Menciona alérgenos e ingredientes principales en los bullets\n- Incluye el momento de consumo ideal (desayuno, post-entreno, merienda)\n- Señala certificaciones si existen (ecológico, sin gluten, vegano)\n- La descripción debe evocar sabor, textura y aroma de forma concreta\n- Evita claims de salud sin respaldo en atributos\nOBJECIONES A ANTICIPAR:\n• "¿Tiene alérgenos?" → menciona trazas o ausencia según atributos\n• "¿A qué sabe exactamente?" → describe sabor y textura con palabras concretas\n• "¿Cuánto dura / cómo se conserva?" → incluye si está en atributos\n═══════════════════════════════════════════\n`],
      [/belleza|cosmético|skincare|perfume|maquillaje|crema|sérum|champú|acondicionador|higiene|cuidado personal/i,
        `\n═══════════════════════════════════════════\nCATEGORÍA: Belleza y Cuidado Personal\n- El primer bullet debe nombrar el beneficio principal en la piel/cabello\n- Menciona el tipo de piel/cabello al que está dirigido\n- Incluye modo de aplicación si está en atributos\n- Usa lenguaje sensorial: textura, aroma, absorción, acabado\n- Señala ingredientes activos clave si están disponibles\nOBJECIONES A ANTICIPAR:\n• "¿Funciona para mi tipo de piel/cabello?" → especifica el tipo target\n• "¿Tiene parabenos/sulfatos/alcohol?" → menciona si está en atributos\n• "¿Cuánto dura el bote/tubo?" → incluye ml/g si están disponibles\n═══════════════════════════════════════════\n`],
    ];
    let categoryContext = "";
    for (const [pattern, context] of categoryRules) {
      if (pattern.test(cat) || pattern.test(listing.productName)) {
        categoryContext = context;
        break;
      }
    }

    // Build marketplace context
    const marketplaceRules: Record<string, string> = {
      amazon_es: `\n═══════════════════════════════════════════\nPLATAFORMA: Amazon España\n- Título: máximo 200 caracteres, keyword principal en las primeras 5 palabras\n- Bullets: máximo 200 caracteres cada uno, sin punto final, empezar con mayúsculas\n- Descripción: sin HTML, sin emojis en bullets, prioriza keywords del algoritmo A9\n- Prioridad: conversión + posicionamiento orgánico Amazon\n═══════════════════════════════════════════\n`,
      etsy: `\n═══════════════════════════════════════════\nPLATAFORMA: Etsy\n- Título: máximo 140 caracteres, muy rico en keywords long-tail separadas por comas\n- Estilo: artesanal, personal, historia del producto, tono cercano y auténtico\n- Descripción: narrativa larga con múltiples variaciones de keywords para SEO Etsy\n- Prioridad: búsqueda orgánica Etsy + conexión emocional con el comprador\n═══════════════════════════════════════════\n`,
      shopify: `\n═══════════════════════════════════════════\nPLATAFORMA: Tienda Shopify / Web propia\n- Sin límite estricto de caracteres\n- Descripción narrativa larga favorece el SEO de Google (300-500 palabras ideal)\n- Puedes usar formato rico: párrafos, énfasis, estructura clara\n- Prioridad: conversión directa + SEO Google + diferenciación de marca\n═══════════════════════════════════════════\n`,
      wallapop: `\n═══════════════════════════════════════════\nPLATAFORMA: Wallapop\n- Título: máximo 60 caracteres, muy conciso, incluye estado y precio si aplica\n- Descripción: corta (80-120 palabras), tono informal y directo, sin bullets formales\n- El precio, estado y disponibilidad deben quedar claros en las primeras líneas\n- Prioridad: claridad, confianza, respuesta rápida del comprador\n═══════════════════════════════════════════\n`,
    };
    const marketplaceContext = marketplaceRules[marketplace ?? "generico"] ?? "";

    let voiceProfileContext = "";
    if (voiceProfile?.profile) {
      const vp = voiceProfile.profile as { tone?: string; vocabulary?: string; sentenceStructure?: string; keyWords?: string[]; brandPersonality?: string };
      voiceProfileContext = `\n═══════════════════════════════════════════\nVOZ DE MARCA ACTIVA: "${voiceProfile.name}"\n- Tono: ${vp.tone ?? "no definido"}\n- Vocabulario: ${vp.vocabulary ?? "no definido"}\n- Estructura de frases: ${vp.sentenceStructure ?? "no definido"}\n- Palabras clave de marca: ${(vp.keyWords ?? []).join(", ") || "ninguna"}\n- Personalidad: ${vp.brandPersonality ?? "no definida"}\nAdapta el copy respetando esta voz cuando no contradiga la instrucción del usuario.\n═══════════════════════════════════════════\n`;
    }

    let competitorContext = "";
    if (competitors.length > 0) {
      const kwList = competitors
        .flatMap((c) => {
          const kw = c.scrapedKeywords ? String(c.scrapedKeywords).split(/[,\n]+/).map((k) => k.trim()).filter(Boolean) : [];
          const titleWords = c.scrapedTitle ? c.scrapedTitle.split(/\s+/).slice(0, 6).join(" ") : "";
          return [...kw.slice(0, 5), ...(titleWords ? [titleWords] : [])];
        })
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 15);
      if (kwList.length > 0) {
        competitorContext = `\n═══════════════════════════════════════════\nKEYWORDS DE COMPETIDORES (${competitors.length} analizados)\nÚsalas de forma natural cuando aplique para SEO:\n${kwList.map((k) => `• ${k}`).join("\n")}\n═══════════════════════════════════════════\n`;
      }
    }

    // Build system prompt with product context
    const bullets = (listing.generatedBullets as string[] | null) ?? [];
    const mergedAttributes = { ...(listing.attributes as Record<string, unknown> ?? {}), ...supplementalAttrs };
    const systemPrompt = AGENT_SYSTEM_PROMPT
      .replace("{productName}", listing.productName)
      .replace("{category}", listing.category ?? "General")
      .replace("{attributes}", JSON.stringify(mergedAttributes))
      .replace("{currentTitle}", listing.generatedTitle ?? "")
      .replace("{currentBullets}", bullets.join("\n"))
      .replace("{currentDescription}", listing.generatedDescription ?? "")
      .replace("{categoryContext}", categoryContext)
      .replace("{marketplaceContext}", marketplaceContext)
      .replace("{voiceProfileContext}", voiceProfileContext)
      .replace("{competitorContext}", competitorContext);

    const detectedCommand = command ?? detectCommand(message);
    const startTime = Date.now();
    const newConvId = uuidv4();

    // Atomically deduct 2 credits BEFORE starting the AI call to prevent TOCTOU races.
    // Auto-iterate turns are pre-paid as a single flat 4-credit charge before the loop
    // starts (see /api/agent/auto-iterate) — skip the per-turn charge here, or the
    // same run would be billed twice.
    let remainingCreditsAfterCharge: number | null = null;
    if (!isAutoIterate) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const creditResult = await useCredits(userId, 2, "Consulta de agente");
      if (!creditResult.success) {
        log.info({ userId }, "Insufficient agent credits");
        return NextResponse.json({
          error: "Sin créditos",
          upsell: true,
          message: "Has agotado tus consultas gratuitas. Compra más consultas o actualiza a Pro.",
          plans: [
            { name: "20 consultas", price: 1.99 },
            { name: "50 consultas", price: 2.99 },
            { name: "100 consultas", price: 3.99 },
            { name: "Plan Pro", price: 29 },
          ],
        }, { status: 402 });
      }
      remainingCreditsAfterCharge = creditResult.remainingCredits;
    }

    // When formal tone is requested, inject anti-jargon guard into the AI user message.
    // The stored/displayed message remains the original — only the AI sees the injected version.
    const JARGON_WORDS = ["idónea", "idóneo", "óptima", "óptimo", "fusionando", "integración de", "Considere", "pieza esencial", "estética refinada", "configuraciones de vestuario", "resistencia óptima", "diversas situaciones", "entornos multifuncionales", "confiere", "multifuncional"];
    const aiUserMessage = FORMAL_TRIGGER_RE.test(message)
      ? `⚡ REGLA CRÍTICA PARA ESTA RESPUESTA — tono formal/profesional significa EXACTAMENTE:\n- Frases directas con datos reales de los atributos\n- Sin adjetivos vagos ni vocabulario elevado\n- PROHIBIDAS estas palabras exactas: ${JARGON_WORDS.map((w) => `"${w}"`).join(", ")}\n- EJEMPLO CORRECTO: "ALGODÓN 80% / POLIÉSTER 20%: mantiene la forma tras 50 lavados, suave al tacto"\n- EJEMPLO INCORRECTO: "COMPOSICIÓN PREMIUM: mezcla óptima que confiere propiedades superiores"\n\nInstrucción del usuario: ${message}`
      : message;

    const historyMessages = messages.slice(0, -1).map(({ role, content }) => ({ role, content }));

    // Call AI provider with streaming
    const aiProvider = getDefaultProvider();
    const aiConfig = providers[aiProvider];
    log.info({ userId, provider: aiProvider, model: aiConfig.defaultModel }, "Agent AI provider selected");
    const stream = await aiConfig.client.chat.completions.create({
      model: aiConfig.defaultModel,
      messages: [
        { role: "system", content: systemPrompt },
        ...historyMessages,
        { role: "user", content: aiUserMessage },
      ] as never,
      temperature: 0.7,
      max_tokens: 1024,
      stream: true,
      response_format: { type: "json_object" },
    }, { signal: req.signal } as never);

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

          // Jargon validation: if formal tone was requested but output still contains corporate jargon, retry once
          if (FORMAL_TRIGGER_RE.test(message)) {
            const textToCheck = [
              String(parsedResponse.updatedDescription ?? ""),
              ...(Array.isArray(parsedResponse.updatedBullets) ? parsedResponse.updatedBullets.map(String) : []),
            ].join(" ");
            const foundJargon = JARGON_WORDS.filter((w) => textToCheck.toLowerCase().includes(w.toLowerCase()));
            if (foundJargon.length > 0) {
              log.debug({ userId, foundJargon }, "Jargon detected, retrying");
              try {
                const retryContent = await aiConfig.client.chat.completions.create({
                  model: aiConfig.defaultModel,
                  messages: [
                    { role: "system", content: systemPrompt },
                    ...historyMessages,
                    {
                      role: "user",
                      content: `⛔ REESCRIBE COMPLETAMENTE. Tu respuesta anterior usó estas palabras PROHIBIDAS: ${foundJargon.map((w) => `"${w}"`).join(", ")}.\n\nReglas absolutas para tono formal:\n1. Cada bullet empieza con CONCEPTO EN MAYÚSCULAS: seguido de datos reales del producto\n2. Usa los materiales exactos: ${JSON.stringify(mergedAttributes)}\n3. Frases cortas (máx 15 palabras por cláusula), sin subordinadas largas\n4. Sin las palabras prohibidas listadas arriba\n\nInstrucción original del usuario: ${message}`,
                    },
                  ] as never,
                  temperature: 0.2,
                  max_tokens: 1024,
                  stream: false,
                  response_format: { type: "json_object" },
                });
                const retryText = retryContent.choices[0]?.message?.content ?? "";
                if (retryText) {
                  parsedResponse = JSON.parse(retryText);
                  parsedResponse._retried = true;
                  log.debug({ userId }, "Formal retry corrected");
                }
              } catch (retryErr) {
                log.warn({ userId, err: retryErr }, "Formal retry failed");
              }
            }
          }

          // Detect specs that may have been fabricated (not present in original attributes)
          const inventedSpecs = detectInventedSpecs(parsedResponse, listing.attributes);
          if (inventedSpecs.length > 0) {
            parsedResponse._inventedSpecs = inventedSpecs;
            log.warn({ userId, inventedSpecs }, "Possible fabricated specs detected");
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
          messages.push({ role: "assistant", content: fullResponse, timestamp: Math.floor(Date.now() / 1000) });
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

          trackGamification(userId, "agent_chat").catch((e) => log.warn({ err: e }, "trackGamification failed"));

          const finalConvId = conversation?.id ?? newConvId;

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            done: true,
            parsed: parsedResponse,
            conversationId: finalConvId,
            ...(remainingCreditsAfterCharge !== null ? { remainingCredits: remainingCreditsAfterCharge } : {}),
            isFree,
          })}\n\n`));

          log.info({ userId, latencyMs: latency, command: detectedCommand, remainingCredits: remainingCreditsAfterCharge, isAutoIterate }, "Agent request completed");
          controller.close();
        } catch (error) {
          log.error({ userId, err: error }, "Agent streaming error");
          // Refund the pre-deducted credit since the AI call failed. Auto-iterate
          // turns didn't pay a per-turn charge here — their flat 4-credit fee is
          // refunded at the loop level on total failure (see /api/agent/auto-iterate).
          if (!isAutoIterate) {
            await addCredits(userId, 2, "refund", "Reembolso por error de agente").catch((e) =>
              log.warn({ err: e }, "Credit refund failed")
            );
          }
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
    log.error({ err: error }, "Agent general error");
    return NextResponse.json({ error: "Error al procesar la consulta" }, { status: 500 });
  }
}
