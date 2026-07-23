# Modo Ficha Técnica — Design

**Fecha:** 2026-07-23
**Origen:** Feedback de early adopter (Head de Ecommerce, Drop Send — persianas/mosquiteras/estores a medida). El modo corto actual (título + 4-6 bullets + descripción de 150-280 palabras) no encaja con catálogos técnicos que necesitan fichas largas y estructuradas (especificaciones, instalación, FAQs).

## Alcance

Un cuarto modo de generación (`tecnica`), junto a los existentes `creative | professional | seo`. Solo cambia la **descripción**; título y bullets mantienen las reglas actuales. Sin migración de base de datos: la descripción larga con apartados se guarda en el mismo campo `generatedDescription` como un único string, usando marcadores `## <Sección>` para delimitar apartados.

Explícitamente fuera de alcance en esta iteración:
- Constructor configurable de apartados (los 3 apartados son fijos: especificaciones técnicas, instalación, FAQs).
- Input enriquecido (URL/PDF como fuente) — se diseñará en un ciclo aparte.
- Adaptar el Health Score / análisis del Agente a este modo — seguirán aplicando las reglas del modo corto (conocido, documentado, no se soluciona ahora).

## Arquitectura y cambios por archivo

1. **`src/lib/ai/prompts.ts`**
   - Nueva entrada `tecnica` en `MODE_CONFIG` (mismo patrón que `creative/professional/seo`).
   - Su `systemPrompt` instruye: descripción larga (~500-700 palabras) estructurada en 3 apartados fijos con marcadores `## Especificaciones técnicas`, `## Instalación`, `## Preguntas frecuentes`.
   - Debe **anular explícitamente** la regla general de "DESCRIPCIÓN (2 a 3 párrafos)" del `SYSTEM_PROMPT` base, que hoy aplica a todos los modos sin condicional.
   - Título y bullets: sin cambios (60-100 chars / 4-6 bullets, igual que hoy).

2. **`src/trigger/jobs/process-products.ts`**
   - `max_tokens` pasa de fijo (`1600`) a condicional: ~3000 cuando `safeMode === "tecnica"`, ya que la salida es sustancialmente más larga.
   - Sin cambios en `generatedContentSchema` (zod) — `description: z.string().min(1)` ya admite cualquier longitud.

3. **`src/app/dashboard/page.tsx`**
   - El selector de modo (bloque `mode-selector`, hoy `creative/professional/seo`) gana una 4ª opción "🔧 Ficha Técnica" con tooltip explicativo.
   - `GenerationMode` (tipo local duplicado del de `prompts.ts`) se actualiza a 4 valores.

4. **`src/app/api/upload/route.ts`**
   - El cobro de créditos (`useCredits(userId, newProductsCount, ...)`) pasa a `newProductsCount * (mode === "tecnica" ? 2 : 1)` — refleja el mayor coste de generación, decisión validada con el usuario.

5. **Renderizado (dashboard + página pública de listing compartido)**
   - Nuevo helper compartido (`src/lib/listings/render-sections.ts` o similar) que detecta marcadores `## ` en `generatedDescription` y los separa en secciones con encabezado con estilo.
   - Si no hay marcadores (todas las descripciones existentes en modo corto), se renderiza exactamente igual que hoy — retrocompatible, sin caso de error nuevo.
   - Usado en el panel de detalle de `src/app/dashboard/page.tsx` y en `src/app/share/[slug]/page.tsx`.

## Testing

- Test unitario: `MODE_CONFIG.tecnica` existe, tiene `systemPrompt` y `temperature`.
- Test unitario: cálculo de créditos (`newProductsCount * 2` cuando `mode === "tecnica"`, `* 1` en el resto).
- Test unitario: helper de renderizado — con marcadores → array de secciones; sin marcadores → texto plano igual que antes (caso de regresión explícito).
- Typecheck (`tsc --noEmit`) y suite Jest completa antes de cada commit.
- Verificación manual en staging con un producto real de este perfil (persiana/mosquitera) antes de mergear a `main`.

## Despliegue

`staging` está desactualizada respecto a `main` (le faltan ~20 commits, incluidos los fixes de esta sesión). Plan:
1. Rama de feature desde `main` (ya incluye todos los fixes recientes).
2. Implementar, testear, commitear en la rama de feature.
3. Merge de la rama de feature → `staging`, push → Render despliega automáticamente el servicio de staging (esto también pone `staging` al día con los fixes de `main`).
4. Validación manual del usuario en staging.
5. Solo si funciona: merge → `main`, push → producción.
