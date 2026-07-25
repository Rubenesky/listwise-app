# Input Enriquecido — Design

**Fecha:** 2026-07-25
**Origen:** Segunda mejora priorizada del feedback de early adopter (Head de Ecommerce, Drop Send — persianas/mosquiteras/estores a medida), tras Modo Ficha Técnica. Javier necesita que la ficha técnica generada incluya especificaciones reales del fabricante que hoy no caben en `productName + category + attributes` del CSV. Analizado con panel de expertos (2 rondas + 3 matices finales) antes de diseñar; puntuación final del panel: 9/10 con las 17 mejoras incorporadas.

## Alcance

Permitir aportar una fuente de contenido adicional para la generación — una **URL** (ficha propia o de proveedor) o un **PDF de proveedor con texto seleccionable** — que se usa como contexto extra junto a `productName + category + attributes`. No sustituye a esos campos, los complementa.

Explícitamente fuera de alcance en esta iteración:
- URL de un competidor como fuente (riesgo legal de derivar copy de contenido de terceros con copyright) — se evaluará en un ciclo aparte.
- PDF escaneado/imagen sin texto seleccionable (necesitaría OCR o visión) — ver "Manejo de PDF sin texto" más abajo.
- Pipeline de scraping/OCR a escala — la ingesta es mínima, pensada como contexto de prompt, no como producto de scraping en sí mismo.
- Merge a `main` — esta feature se implementa y valida **solo en `staging`**, con el mismo patrón que Modo Ficha Técnica. La decisión de mergear a `main` se toma después, en una conversación aparte, tras validar con Javier.

## Decisiones de diseño (panel de expertos)

Estas 17 decisiones vienen de un análisis con 10 perspectivas expertas (Product, UX, AI/Prompt Engineering, Backend, Seguridad, Legal, Cost/Infra, Growth, Sales/CS, QA) en dos rondas, más 3 matices de una ronda final. Se listan aquí como referencia y contrato de diseño — cada una se traduce en una sección técnica concreta más abajo.

1. Seguridad SSRF por diseño (no parcheado después).
2. Extracción estructurada intermedia — nunca se inyecta el texto crudo de la fuente en el prompt de generación.
3. Fallback no bloqueante — si falla la extracción, la generación continúa igual con los datos manuales.
4. Preview editable de lo extraído antes de generar.
5. Alcance inicial acotado a fuente propia/de proveedor (sin URL de competidor).
6. Métrica de éxito cuantitativa con umbral concreto.
7. Reutilización de la fuente — se guarda asociada al listing para regenerar sin re-subir.
8. Rate limiting específico en el endpoint de fetch/enriquecimiento.
9. Transparencia de coste antes de comprometerse.
10. Punto de enganche del flujo: URL vía columna CSV opcional; PDF vía acción individual sobre un listing ya creado.
11. Regla de precedencia: el atributo manual del CSV siempre gana sobre lo extraído.
12. Retención: solo se guarda el texto extraído (no el binario del PDF), con caducidad de 30 días.
13. Consentimiento explícito del usuario al subir un PDF.
14. Umbral de éxito de la métrica del punto 6 explícito en este spec (ver "Testing").
15. Lanzamiento por fases: beta cerrada solo con el perfil de Javier antes de abrir a toda la base.
16. Manejo de idioma: detectar si la fuente está en un idioma distinto y avisar/traducir antes de usarla como contexto.
17. Revisión de seguridad específica del endpoint de fetch antes de cualquier futuro merge a producción (gate posterior a este diseño, no parte de la implementación en sí).

## Arquitectura y reuso de código existente

El proyecto ya tiene, en `staging`, una función de protección SSRF completa y en producción (`validateUrlSSRF` en `src/app/api/competitor/analyze/route.ts`: valida esquema, resuelve DNS, bloquea IPs privadas IPv4/IPv6), un rate limiter dedicado (`ratelimitCompetitor`) y una tabla con patrón de caché por expiración (`competitorAnalyses.cacheExpiresAt`). Esta feature reutiliza esos patrones en vez de reinventarlos:

1. **`src/lib/security/ssrf.ts`** (nuevo, extraído de `competitor/analyze/route.ts`)
   - Mueve `validateUrlSSRF` aquí para que ambas features (competitor-analyze e input-enriquecido) importen la misma implementación en vez de duplicarla una tercera vez.
   - `competitor/analyze/route.ts` se actualiza para importar desde aquí (sin cambio de comportamiento).

2. **`src/lib/rate-limit.ts`**
   - Nueva entrada `ratelimitEnrichedInput` (10 solicitudes/día por usuario), mismo patrón que `ratelimitCompetitor`. Se comprueba en **ambos** puntos de entrada: en `src/app/api/upload/route.ts` (una vez por fila con `sourceUrl`, no una vez por CSV) y en `POST /api/listings/[id]/enrich` — comparten el mismo contador por usuario, no son cupos independientes.

3. **`src/lib/scraping/extract-text.ts`** (nuevo)
   - Función simple de HTML → texto legible con cheerio: elimina `script/style/nav/footer/header/iframe`, extrae título (`h1`/`og:title`/`<title>`) + párrafos + encabezados. Deliberadamente más simple que `analyze-competitor.ts` (esa está especializada en scraping de e-commerce — precio, JSON-LD de producto — que no aplica aquí).

4. **`src/lib/pdf/extract-text.ts`** (nuevo)
   - Usa la nueva dependencia `pdf-parse` para extraer texto del PDF.
   - Heurística "sin texto" (PDF escaneado): si el texto extraído tiene menos de 50 caracteres por página, se trata como no soportado.

5. **`src/db/schema.ts`** — nueva tabla `enrichedSources`:
   ```ts
   export const enrichedSources = sqliteTable("enriched_sources", {
     id: text("id").primaryKey(),
     userId: text("user_id").notNull(),
     listingId: text("listing_id"), // null hasta asociarse a un listing
     sourceType: text("source_type").notNull(), // "url" | "pdf"
     sourceRef: text("source_ref").notNull(), // URL o nombre de archivo original
     status: text("status").notNull().default("PENDING"), // PENDING | COMPLETED | FAILED
     extractedText: text("extracted_text"), // texto ya extraído, nunca el binario
     errorMessage: text("error_message"),
     cacheExpiresAt: integer("cache_expires_at"), // now + 30 días
     createdAt: integer("created_at").notNull().default(0),
   }, (table) => ({
     userIdx: index("idx_enriched_sources_user_id").on(table.userId),
     listingIdx: index("idx_enriched_sources_listing_id").on(table.listingId),
   }));
   ```
   No se reutiliza `competitorAnalyses` directamente — esa tabla está formada para comparar tono/fortalezas de un competidor (`analysis` JSON), no para specs en bruto. Se reutiliza el *patrón* (tabla con caché por expiración + estado PENDING/COMPLETED/FAILED), no la tabla en sí.
   - Migración manual vía Turso CLI, mismo proceso que `drizzle/0002_add_generation_mode.sql` — **debe aplicarse antes de desplegar el código que la usa** (misma lección aprendida esta sesión: `ALTER TABLE`/`CREATE TABLE` sin `IF NOT EXISTS` en el caso de `ADD COLUMN`; `CREATE TABLE IF NOT EXISTS` sí es válido para tablas nuevas).

## Flujo URL — columna opcional en el CSV

- La plantilla CSV gana una columna opcional `sourceUrl`.
- En `src/app/api/upload/route.ts`: si una fila trae `sourceUrl`, se valida con `validateUrlSSRF` en el momento del upload; si es válida, se crea una fila `enrichedSources` (`PENDING`) vinculada al `listingId`.
- El fetch + extracción de texto ocurre **dentro del mismo job de Trigger.dev** que ya procesa el producto (`process-products.ts`) — no se orquesta un job asíncrono aparte por fuente.
- Si falla (fetch, timeout, contenido pobre): `enrichedSources.status = FAILED`, pero la generación del listing **continúa igual** con `productName + category + attributes` (fallback no bloqueante). El listing muestra un aviso: *"No se pudo leer la fuente indicada — el producto se generó sin ella."*

## Flujo PDF — acción sobre un listing individual

- Nuevo endpoint `POST /api/listings/[id]/enrich` (mismo patrón que `variants/route.ts`): recibe el PDF vía `FormData`, valida tipo (`application/pdf`) y tamaño (máx 5MB, 10 páginas).
- Extrae texto con `pdf-parse`.
  - **Si no hay texto suficiente** (PDF escaneado/imagen): se responde sin cobrar crédito, sin crear generación, con el mensaje exacto: *"Este PDF parece ser una imagen escaneada — no pudimos leer texto seleccionable. La generación continuará sin esta fuente."* (matiz de Chris Voss: el mensaje debe dejar claro que es una limitación conocida, no un error genérico de la app).
  - **Si hay texto**: se muestra en un preview editable en el modal del listing — el usuario puede corregir/recortar antes de confirmar.
- Requiere marcar el checkbox de consentimiento ("confirmo que tengo derecho a usar este documento") antes de habilitar el botón de confirmar.
- Al confirmar: se dispara la regeneración del listing con el contexto añadido. **Coste**: el mismo crédito que ya cuesta generar ese producto (1 para creative/professional/seo, 2 para tecnica) — no hay recargo aparte. Al no existir ya el caso de visión/OCR en v1 (ver más abajo), no hay escalón de coste adicional que gestionar ni mostrar; la transparencia de coste (decisión #9) queda resuelta por simplicidad — no hay sorpresa porque no hay coste nuevo.

## Manejo de PDF sin texto (decisión de alcance)

El caso de PDF escaneado que necesitaría OCR/visión queda **explícitamente fuera de v1** — no se implementa renderizado de páginas a imagen ni llamadas de visión. Los PDFs de fabricantes (fichas técnicas, catálogos) suelen tener texto seleccionable de forma nativa; este caso cubre el uso real esperado de Javier sin añadir la complejidad y el coste de una dependencia de renderizado (`pdfjs-dist`/`canvas`) para un caso límite que puede no aparecer en la práctica. Si el beta revela que es un caso frecuente, se diseña como iteración aparte.

## Integración con el prompt (`src/lib/ai/prompts.ts`)

- **Extracción estructurada intermedia**: una llamada barata (Groq, modelo pequeño) reduce el `extractedText` crudo a un JSON de "especificaciones confirmadas" — mismo formato que `product.attributes`. Nunca se inyecta el texto crudo completo en el prompt de generación principal.
- **Precedencia**: al fusionar `product.attributes` (manual, del CSV) con las specs extraídas, cualquier clave ya presente en `attributes` gana. La extraída solo rellena huecos que el usuario no rellenó. Conflictos en la misma clave se descartan del lado extraído y se anotan en el preview.
- **Idioma**: heurística simple (sin llamada de IA aparte) sobre el idioma del `extractedText` antes de la extracción estructurada; si difiere del idioma esperado del producto, se añade una instrucción de traducción al paso de extracción.
  - **Limitación conocida** (matiz de Steli Efti): esta heurística puede fallar con textos cortos o mixtos (común en fichas técnicas con términos en inglés dentro de texto en español). Aceptable para v1 — el peor caso es una traducción innecesaria, no un dato incorrecto. Queda anotado como mejora futura, no bloquea esta iteración.

## Testing

- Unitarios: `validateUrlSSRF` (ya cubierto, mover tests si existen junto con el módulo), extracción HTML→texto, extracción PDF→texto (caso con texto y caso "sin texto" tratado como no soportado), fusión de atributos con precedencia manual-gana, heurística de idioma, schema de `enrichedSources`, rate limiter.
- Typecheck (`tsc --noEmit`), lint y suite Jest completa antes de cada commit — mismo estándar que el resto del proyecto esta sesión.
- **Criterios de éxito del beta** (decisiones #6/#14, con el matiz de Josh Braun añadido):
  1. **Cuantitativo**: comparar el Health Score promedio de los últimos listings en modo `tecnica` generados **sin** fuente vs los primeros generados **con** fuente durante el beta de Javier. Éxito = el promedio con fuente no baja, idealmente +5 puntos o más.
  2. **Cualitativo**: preguntar directamente a Javier, tras probar la feature, si la descripción generada ahora incluye la información técnica que antes echaba en falta (sí/no + qué sigue faltando, si aplica). Un Health Score más alto sin que Javier confirme que se resolvió su problema original no cuenta como éxito — ambos criterios deben ser positivos.
- Verificación manual en staging: CSV con columna `sourceUrl` real y un PDF real de ficha de proveedor (idealmente uno de ejemplo que aporte Javier) sobre un listing ya creado.

## Despliegue

Mismo patrón que Modo Ficha Técnica, confirmado explícitamente para esta feature:

1. Rama `feature/input-enriquecido` desde `staging`.
2. Implementar + testear (typecheck/lint/jest) en la rama.
3. Merge a `staging` (fast-forward) → push → Render despliega el servicio de staging automáticamente.
4. Validación manual propia en staging antes de invitar a nadie.
5. Invitar a Javier a probar esta feature **y** Modo Ficha Técnica en `staging` — requiere crearle una cuenta en el Clerk de staging (instancia separada de la de producción, distinta `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`/`CLERK_SECRET_KEY` según `render.yaml`).
6. Recoger su feedback y medir los dos criterios de éxito.
7. **Solo si ambos criterios son positivos**: se decide, en una conversación aparte, si se mergea a `main`. No se mergea a `main` como parte de esta iteración bajo ninguna circunstancia.
8. Antes de cualquier futuro merge a producción: revisión de seguridad específica del endpoint de fetch/enriquecimiento (decisión #17), más allá de la validación de este diseño.
