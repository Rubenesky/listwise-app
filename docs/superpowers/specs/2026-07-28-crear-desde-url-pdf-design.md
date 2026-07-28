# Crear producto desde URL o PDF — Design

**Fecha:** 2026-07-28
**Origen:** Feedback literal de Javier (Drop Send): "subir la URL de la ficha actual, la de un competidor con el mismo producto o subiéndole un PDF del proveedor, te hiciera una ficha completa." Amplía la feature "Input Enriquecido" (`docs/superpowers/specs/2026-07-25-input-enriquecido-design.md`), que hasta ahora solo permitía enriquecer un producto **ya generado** (columna `sourceUrl` en el CSV, o el botón "📎 Enriquecer" con PDF). Javier quiere crear un producto **nuevo** directamente desde una URL o un PDF, sin pasar por el CSV.

## Decisión de arquitectura (pivote respecto al primer borrador)

El primer borrador de esta mejora asumía "enriquecer un listing existente" (`POST /api/listings/[id]/enrich-url`, reutilizando `enrichedSources` y el endpoint de confirmación ya existente). Tras aclarar con el usuario la ubicación deseada en el dashboard (debajo de "Subir CSV", no en la columna Acciones de un producto ya creado), el flujo real es **crear un producto desde cero** — mismo espíritu que el antiguo `PhotoUploader` (eliminado en `9f6729c8` por no estar terminado), pero basado en texto (URL/PDF) en vez de visión por imagen, y construido sobre la infraestructura de seguridad ya endurecida de Input Enriquecido (SSRF, rate limiting, extracción).

Esto significa que **no hace falta la tabla `enrichedSources` para este flujo** — no hay atributos manuales previos con los que fusionar (decisión #11 de "precedencia" no aplica aquí: la fuente extraída *es* la única fuente de verdad, ya que el usuario la revisa/edita en el preview antes de crear).

## Alcance

Dos endpoints nuevos + un componente nuevo en el dashboard, debajo de "Subir CSV":

1. **Analizar** (`POST /api/listings/analyze-source`): recibe una URL o un PDF, extrae texto (reutilizando módulos ya existentes), y devuelve un preview de producto (`productName`, `category`, `attributes`, `primaryKeyword`, `confidence`) — **sin cobrar crédito, sin crear el listing todavía**.
2. **Crear** (`POST /api/listings/create-from-source`): recibe el preview (editado o no) + modo de generación elegido, cobra el crédito correspondiente, inserta un listing en `PENDING` y dispara el mismo job de Trigger.dev (`process-batch`) que ya usa la subida CSV — sin lógica de generación nueva.
3. **UI**: pestañas "Pegar URL" / "Subir PDF" debajo de "Subir CSV", con extracción → preview editable → confirmar.

Explícitamente fuera de alcance:
- No se toca el CSV con columna `sourceUrl` (sigue igual).
- No se toca el flujo "📎 Enriquecer" de PDF sobre un producto ya generado (sigue igual).
- No se mergea a `main`.

## Reuso de infraestructura ya existente

| Pieza | Módulo reutilizado |
|---|---|
| Validación SSRF de la URL | `src/lib/security/ssrf.ts` (`validateUrlSSRF`) |
| Rate limiting | `src/lib/rate-limit.ts` (`ratelimitEnrichedInput`, mismo pool compartido de 10/día) |
| Extracción de texto de URL | `src/lib/scraping/extract-text.ts` (`fetchAndExtractText`) |
| Extracción de texto de PDF | `src/lib/pdf/extract-text.ts` (`extractTextFromPdf`) |
| Disparo del job de generación | El mismo mecanismo `sendTriggerEvent`/`process-batch` que ya usa `src/app/api/upload/route.ts` |
| Cobro/reembolso de créditos | `src/lib/credits/use-credits.ts` (mismo patrón que `upload/route.ts`) |

## Pieza nueva: extracción de información de producto desde texto

`src/lib/ai/extract-product-info.ts` — nueva función `extractProductInfoFromText(text, sourceUrl?): Promise<{productName, category, attributes, primaryKeyword, confidence}>`. Llamada barata a Groq (mismo proveedor/coste que `extractSpecsFromText`), con un prompt distinto: en vez de extraer specs para fusionar con atributos ya existentes, extrae la ficha completa de un producto nuevo a partir de texto — mismo JSON de salida que el antiguo `VISION_PROMPT` del `PhotoUploader` (`productName`, `category`, `attributes`, `primaryKeyword`, `confidence`), pero a partir de texto scrapeado/extraído en vez de una imagen.

**Matiz de precisión (aportado por revisión de expertos, incorporado al diseño):**
- A diferencia de una foto (donde el modelo de visión solo ve el producto), una URL scrapeada trae ruido alrededor — menú, productos relacionados, reseñas, publicidad. El prompt debe instruir explícitamente distinguir "el producto principal de esta página" del resto del contenido.
- El indicador de confianza (`confidence`, con el mismo componente visual `ConfidenceDot` de alta/media/baja que tenía el antiguo `PhotoUploader`) se mantiene, y además: si la confianza es baja, se muestra un aviso explícito ("revisa todos los campos antes de crear"), no solo un punto de color pasivo.
- Antes de invitar a Javier, se hará una prueba manual en staging con una URL/PDF real de su sector (persianas, mosquiteras, mobiliario a medida) — pendiente de que él la aporte tras la implementación.

## Coste en créditos — decisión explícita (difiere del antiguo PhotoUploader)

El antiguo `PhotoUploader` cobraba 1 crédito en el paso de **análisis**, porque ese análisis era una llamada de visión de Claude (cara). Aquí, `extractProductInfoFromText` es una llamada de texto a Groq (barata, misma clase de coste que `extractSpecsFromText`) — por eso:
- **Analizar**: sin coste, igual que el preview del flujo "📎 Enriquecer" de PDF.
- **Crear**: cobra `MODE_CONFIG[mode].creditsPerProduct` (1 para creative/professional/seo, 2 para tecnica) — el mismo coste que un producto generado vía CSV, cobrado en el momento de disparar la generación real, no antes. Consistente con el principio de transparencia de coste ya establecido en el resto de esta feature.

## UI — botón de confirmación

Por ser creación de un producto nuevo (no edición de uno existente), el botón de confirmar debe dejar explícito que va a consumir crédito y arrancar la generación — mismo principio de transparencia ya aplicado en el resto de Input Enriquecido.

## Testing

- Unitario: `extractProductInfoFromText` (parseo de JSON, manejo de fallo no bloqueante, filtrado de valores no-string).
- Unitario: el endpoint de análisis (auth, rate limit compartido, validación SSRF/tipo de archivo, PDF escaneado → error claro sin cobrar).
- Unitario: el endpoint de creación (cobro de crédito según modo, inserción del listing, disparo del trigger, reembolso si el trigger falla).
- Manual en staging: URL real de un producto (competidor o ficha propia) y un PDF real de ficha técnica — antes de invitar a Javier.

## Despliegue

Mismo patrón que el resto de la feature: implementar en `feature/input-enriquecido` (ya existe como worktree), fast-forward a `staging`, validar manualmente, invitar a Javier a probar los 3 flujos (URL/PDF individual + CSV + Ficha Técnica) antes de decidir el merge a `main`.
