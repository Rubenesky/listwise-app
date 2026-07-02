export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  readMinutes: number;
  category: string;
  content: string;
}

export const posts: BlogPost[] = [
  {
    slug: "como-generar-descripciones-productos-amazon-ia",
    title: "Cómo generar descripciones de productos para Amazon con IA",
    description:
      "Aprende a crear títulos SEO, bullet points y descripciones optimizadas para Amazon usando inteligencia artificial. Guía paso a paso con ejemplos reales.",
    publishedAt: "2026-06-20",
    readMinutes: 7,
    category: "Guías",
    content: `
<h2>Por qué las descripciones importan en Amazon</h2>
<p>El algoritmo A9 de Amazon usa el contenido de tu ficha de producto para decidir en qué búsquedas apareces. Una descripción mal escrita no solo convierte peor — directamente no existe para el buscador interno de Amazon.</p>
<p>El problema es que escribir buenos listings requiere dominar tres disciplinas al mismo tiempo: SEO de marketplace, copywriting de conversión y conocimiento de tu producto. La mayoría de vendedores no tienen tiempo ni recursos para hacerlo bien en cada artículo.</p>

<h2>Los 4 elementos de un listing ganador en Amazon</h2>
<p>Antes de hablar de IA, conviene entender qué tiene que tener un listing optimizado:</p>
<ul>
  <li><strong>Título SEO:</strong> 150-200 caracteres con las keywords principales al principio. Incluye marca, modelo, característica principal y beneficio clave.</li>
  <li><strong>Bullet points (puntos clave):</strong> 5 puntos de máximo 200 caracteres cada uno. Empiezan con el beneficio en mayúsculas, luego la característica que lo respalda.</li>
  <li><strong>Descripción:</strong> 2.000 caracteres máximo. Texto emocional que conecta el producto con el estilo de vida del comprador.</li>
  <li><strong>Backend keywords:</strong> Términos alternativos, sinónimos y variaciones que no caben en el texto visible pero que Amazon indexa igualmente.</li>
</ul>

<h2>El enfoque manual: por qué no escala</h2>
<p>Escribir un listing completo de calidad lleva entre 30 y 90 minutos. Si tienes un catálogo de 200 productos, estás hablando de semanas de trabajo solo en contenido. Y eso sin contar las revisiones ni las actualizaciones.</p>
<p>Contratar un copywriter freelance especializado en Amazon cuesta entre 15 y 50€ por producto. Para 200 artículos, el presupuesto supera los 10.000€ — fuera del alcance de la mayoría de tiendas medianas.</p>

<h2>Cómo la IA genera descripciones en segundos</h2>
<p>Los modelos de lenguaje de última generación han sido entrenados con millones de listings de Amazon, fichas de producto y textos de ecommerce. Entienden qué funciona en cada categoría y pueden generar contenido optimizado en segundos.</p>
<p>La clave está en el prompt: un sistema bien diseñado que transmite al modelo el nombre del producto, la categoría, el público objetivo y el tono de voz da como resultado contenido que supera en calidad a muchos redactores humanos junior.</p>

<h2>Paso a paso: generar listings con ListWise</h2>
<ol>
  <li><strong>Descarga la plantilla CSV.</strong> La plantilla incluye columnas para nombre, categoría, precio, materiales y atributos adicionales. Cuanta más información incluyas, mejor será el resultado.</li>
  <li><strong>Rellena el CSV con tu catálogo.</strong> Puedes subir desde 1 hasta cientos de productos en el mismo archivo. No necesitas conocimientos técnicos — es un Excel normal.</li>
  <li><strong>Sube el CSV a ListWise.</strong> La IA procesa cada fila en paralelo. Para 50 productos, el tiempo total es de 2-3 minutos.</li>
  <li><strong>Revisa y ajusta.</strong> El dashboard muestra el título, bullets y descripción de cada producto con un Health Score de 0 a 100. Puedes editar directamente o usar el Agente de Copywriting para refinar con instrucciones en lenguaje natural.</li>
  <li><strong>Exporta el resultado.</strong> Descarga un CSV con todos los listings listos para subir a tu cuenta de Seller Central.</li>
</ol>

<figure style="margin:32px 0;text-align:center;">
  <img src="/blog/dashboard-listwise.png" alt="Dashboard de ListWise con listings generados por IA" width="1200" height="675" style="max-width:100%;border-radius:12px;border:1px solid #e5e7eb;box-shadow:0 4px 16px rgba(0,0,0,0.08);" loading="lazy" />
  <figcaption style="margin-top:10px;font-size:13px;color:#6b7280;font-style:italic;">El dashboard de ListWise muestra título, bullets y descripción optimizados por IA para cada producto, con su Health Score de calidad</figcaption>
</figure>

<h2>Tips para optimizar el resultado de la IA</h2>
<p>La calidad del output depende directamente de la calidad del input. Estos ajustes marcan la diferencia:</p>
<ul>
  <li><strong>Incluye el público objetivo:</strong> "deportistas amateur de running" es más útil que "adultos activos".</li>
  <li><strong>Añade el diferenciador principal:</strong> lo que hace que tu producto sea mejor o diferente a la competencia.</li>
  <li><strong>Especifica el marketplace:</strong> un listing para Amazon.es tiene convenciones distintas a uno para Amazon.de.</li>
  <li><strong>Indica restricciones de longitud:</strong> si vendes en Wallapop, el formato es más corto e informal.</li>
</ul>

<h2>¿Reemplaza la IA al copywriter?</h2>
<p>Para catálogos estándar, sí. Para productos premium o de nicho donde la voz de marca es crítica, la IA hace el 80% del trabajo y el copywriter humano perfecciona el 20% restante — a una fracción del coste y tiempo actuales.</p>
<p>Con el Agente de Copywriting de ListWise puedes usar lenguaje natural para ajustar tono, añadir keywords, cambiar el enfoque del público o analizar a la competencia. Es la forma más rápida de obtener listings que convierten sin depender de un freelance para cada cambio.</p>

<p><strong>¿Listo para probarlo?</strong> ListWise incluye 20 créditos gratis sin tarjeta de crédito. Sube tu primer CSV y ve el resultado en menos de 2 minutos.</p>
    `.trim(),
  },
  {
    slug: "bullet-points-amazon-como-escribirlos",
    title: "Bullet points para Amazon: cómo escribirlos para vender más",
    description:
      "Los bullet points son el elemento más visible de tu ficha de Amazon. Aprende las reglas, errores comunes y cómo la IA puede escribirlos por ti en segundos.",
    publishedAt: "2026-06-24",
    readMinutes: 6,
    category: "Amazon",
    content: `
<h2>Qué son los bullet points en Amazon</h2>
<p>Amazon llama a este campo "Puntos clave del producto" o "Key product features" en el backend. Son los 5 puntos que aparecen justo debajo del título y el precio — la zona más leída de cualquier ficha de producto, con más visibilidad que la propia descripción.</p>
<p>Para el algoritmo A9, los bullet points son uno de los campos de mayor peso SEO después del título. Las keywords que incluyas aquí influyen directamente en las búsquedas donde aparecerás.</p>

<h2>Por qué lo hacen mal la mayoría de vendedores</h2>
<p>El error más común es listar características técnicas en lugar de beneficios. "Material: nylon reforzado 600D" no le dice nada al comprador. "DURADERO PARA SIEMPRE: el nylon 600D soporta más de 50 kg sin deformarse — perfecto para viajes largos" sí convierte.</p>
<p>Otros errores frecuentes:</p>
<ul>
  <li>Puntos demasiado largos (más de 200 caracteres pierden visibilidad en móvil).</li>
  <li>No aprovechar el límite de 5 puntos — dejar alguno vacío es un error de SEO.</li>
  <li>Repetir el mismo beneficio en 3 puntos distintos en lugar de cubrir 5 ángulos diferentes.</li>
  <li>No incluir keywords secundarias en los puntos 3, 4 y 5.</li>
</ul>

<h2>La fórmula que funciona</h2>
<p>Cada bullet point efectivo sigue esta estructura:</p>
<p><strong>BENEFICIO EN MAYÚSCULAS: característica técnica que lo justifica + caso de uso concreto.</strong></p>
<p>Ejemplo para unos auriculares:</p>
<ul>
  <li>BATERÍA PARA TODO EL DÍA: 40 horas de reproducción continua — carga tu productividad en el metro y llega a casa sin quedarte sin música.</li>
  <li>SILENCIO TOTAL: cancelación activa de ruido -35dB elimina voces, tráfico y oficinas abiertas. Concentración máxima en cualquier entorno.</li>
  <li>PLEGABLE Y ULTRALIGERO: 185g y bisagras reforzadas en acero inoxidable. Cabe en cualquier mochila sin ocupar espacio.</li>
  <li>CONEXIÓN INSTANTÁNEA: Bluetooth 5.3 con latencia inferior a 20ms. Sin cortes al alejarte 15 metros del teléfono.</li>
  <li>GARANTÍA REAL: 2 años de garantía oficial + soporte en español. Si algo falla, lo resolvemos sin preguntas.</li>
</ul>

<h2>Orden de los puntos: importa más de lo que crees</h2>
<p>Amazon muestra todos los bullet points en desktop, pero en móvil — donde ocurre más del 60% de las compras — solo muestra los primeros 3 por defecto. Ordena tus puntos así:</p>
<ol>
  <li>El beneficio más diferenciador (el "por qué comprarme a mí").</li>
  <li>La solución al principal pain point del comprador.</li>
  <li>La tercera razón más importante.</li>
  <li>Keywords secundarias + compatibilidad / dimensiones / materiales.</li>
  <li>Garantía, servicio post-venta, soporte.</li>
</ol>

<h2>Keywords: dónde encajan sin forzar</h2>
<p>No se trata de meter keywords a la fuerza — Amazon ya indexa bien el texto natural. La clave es asegurarte de que tus variaciones semánticas aparecen de forma orgánica en al menos 3 de los 5 puntos.</p>
<p>Si vendes "zapatillas running hombre", los puntos deberían incluir de forma natural: "correr", "entrenamiento", "kilómetros", "asfalto", "atletismo" — sin repetir exactamente el mismo término.</p>

<h2>Cómo la IA genera bullet points optimizados</h2>
<p>Herramientas como ListWise generan los 5 puntos siguiendo estas reglas automáticamente. El modelo conoce las convenciones de Amazon por categoría (Electrónica, Moda, Hogar, Deporte...) y adapta el tono, la longitud y el énfasis en beneficios según el tipo de producto.</p>
<p>El proceso es simple: introduces el nombre del producto, la categoría y los atributos principales en el CSV, y en menos de 60 segundos tienes 5 bullet points listos para usar. Si el tono no es exactamente el que buscas, el Agente de Copywriting permite refinarlo con instrucciones como "hazlos más formales" o "añade urgencia y escasez".</p>

<figure style="margin:32px 0;text-align:center;">
  <img src="/blog/agent-mode.png" alt="Agente de Copywriting de ListWise refinando bullet points" width="1200" height="675" style="max-width:100%;border-radius:12px;border:1px solid #e5e7eb;box-shadow:0 4px 16px rgba(0,0,0,0.08);" loading="lazy" />
  <figcaption style="margin-top:10px;font-size:13px;color:#6b7280;font-style:italic;">El Agente de Copywriting de ListWise permite ajustar tono, añadir keywords y refinar los bullets con instrucciones en lenguaje natural</figcaption>
</figure>

<h2>Lo que no puede hacer la IA (todavía)</h2>
<p>La IA no conoce tus datos de reviews — no sabe que el 80% de tus compradores mencionan la facilidad de montaje como la razón principal de satisfacción. Esa información deberías añadirla tú al CSV o usar el Agente para incorporarla.</p>
<p>También es recomendable revisar que las claims técnicas (potencia, batería, dimensiones) sean correctas — la IA puede inferirlas incorrectamente si no están en el input.</p>

<p><strong>¿Quieres generar los bullet points de tu catálogo?</strong> Prueba ListWise gratis con 10 productos — sin tarjeta de crédito.</p>
    `.trim(),
  },
  {
    slug: "seo-para-ecommerce-como-optimizar-fichas-producto",
    title: "SEO para ecommerce: cómo optimizar tus fichas de producto en 2024",
    description:
      "Guía completa de SEO para productos de tienda online. Keywords, títulos, descripciones, marketplaces y cómo usar IA para escalar sin perder calidad.",
    publishedAt: "2026-06-27",
    readMinutes: 9,
    category: "SEO",
    content: `
<h2>Qué es el SEO de producto y por qué es diferente</h2>
<p>El SEO de producto tiene dos dimensiones que hay que trabajar por separado: el SEO en Google para que tu ficha aparezca en búsquedas orgánicas, y el SEO interno del marketplace (Amazon A9, eBay Cassini, Etsy Search) para aparecer cuando alguien busca dentro de la plataforma.</p>
<p>La mayoría de los recursos de SEO se centran en Google — pero si vendes principalmente en Amazon o en otro marketplace, el SEO interno del marketplace tiene mucho más impacto en tus ventas.</p>

<h2>SEO en Google vs SEO en marketplace: diferencias clave</h2>
<p>Google prioriza autoridad de dominio y backlinks; los marketplaces priorizan tasa de conversión y ventas. Los tiempos de ranking también difieren: Google necesita meses, mientras que en Amazon o Etsy puedes ver mejoras en semanas.</p>

<h2>Investigación de keywords para productos</h2>
<p>El punto de partida es entender qué busca exactamente tu comprador potencial. Herramientas útiles:</p>
<ul>
  <li><strong>Amazon Search Suggest:</strong> escribe las primeras letras de tu producto y observa las sugerencias. Son búsquedas reales de compradores.</li>
  <li><strong>Google Keyword Planner:</strong> útil para volumen de búsqueda y variaciones semánticas.</li>
  <li><strong>Helium 10 / Jungle Scout:</strong> si vendes en Amazon, estas herramientas muestran el volumen exacto de búsqueda dentro de la plataforma.</li>
  <li><strong>Reviews de la competencia:</strong> las reseñas de tus competidores contienen el vocabulario exacto que usan tus compradores para describir el producto.</li>
</ul>

<h2>Cómo estructurar el título SEO perfecto</h2>
<p>El título es el elemento más importante para el SEO tanto en Google como en marketplace. La fórmula recomendada varía por plataforma:</p>
<p><strong>Para Amazon:</strong> [Marca] + [Nombre del producto] + [Característica principal] + [Beneficio clave] + [Compatibilidad/Tamaño si aplica]</p>
<p>Ejemplo: <em>Sony WH-1000XM5 Auriculares Inalámbricos Bluetooth | Cancelación Activa de Ruido | 30h Batería | Compatible iOS y Android | Negro</em></p>
<p><strong>Para Google/tienda propia:</strong> [Nombre del producto] - [Beneficio principal] | [Marca]</p>

<h2>La descripción que convierte (y que Google indexa)</h2>
<p>Google indexa el contenido completo de tu ficha de producto. Una descripción larga, bien estructurada con listas y texto de calidad puede posicionarse para búsquedas long tail que llevan tráfico orgánico cualificado.</p>
<p>Estructura recomendada:</p>
<ol>
  <li><strong>Párrafo de apertura:</strong> presenta el producto y el problema que resuelve. Incluye la keyword principal de forma natural.</li>
  <li><strong>Características principales (lista):</strong> 5-8 puntos con las especificaciones más importantes.</li>
  <li><strong>A quién va dirigido:</strong> un párrafo describiendo el perfil del comprador ideal.</li>
  <li><strong>Cómo se usa:</strong> instrucciones básicas de uso. Responde búsquedas del tipo "cómo usar X".</li>
  <li><strong>Cierre emocional:</strong> conecta el producto con el resultado deseado del comprador.</li>
</ol>

<h2>El problema de escalar SEO de producto</h2>
<p>Una tienda con 50 productos puede dedicar tiempo a escribir fichas de calidad manualmente. Pero a 500 o 5.000 referencias, el contenido optimizado se convierte en un cuello de botella.</p>
<p>Las opciones tradicionales generan contenido duplicado, usan descripciones del proveedor (igual que la competencia), requieren equipos internos costosos o freelancers de calidad variable.</p>

<h2>IA para SEO de producto: qué puede y qué no puede hacer</h2>
<p>Los modelos de lenguaje actuales pueden generar contenido de producto de alta calidad para catálogos enteros en minutos. Son especialmente buenos en:</p>
<ul>
  <li>Crear variaciones semánticas únicas para cada producto (evita contenido duplicado).</li>
  <li>Seguir estructuras SEO consistentes en todo el catálogo.</li>
  <li>Adaptar el tono por categoría (técnico para electrónica, emocional para moda).</li>
  <li>Generar metadescripciones optimizadas para CTR.</li>
</ul>
<p>Donde todavía necesitas revisión humana: datos técnicos precisos (dimensiones, materiales, certificaciones) y voz de marca muy específica.</p>

<figure style="margin:32px 0;text-align:center;">
  <img src="/blog/analisis-competencia.png" alt="Análisis de competencia en ListWise" width="1200" height="675" style="max-width:100%;border-radius:12px;border:1px solid #e5e7eb;box-shadow:0 4px 16px rgba(0,0,0,0.08);" loading="lazy" />
  <figcaption style="margin-top:10px;font-size:13px;color:#6b7280;font-style:italic;">ListWise analiza los listings de la competencia e identifica las keywords y estrategias de contenido que usan para posicionarse</figcaption>
</figure>

<h2>Schema.org para fichas de producto en tu tienda propia</h2>
<p>Si vendes en tu propia tienda WooCommerce, Shopify o Prestashop, implementar Schema.org de tipo <code>Product</code> con <code>Offer</code>, precio, disponibilidad y valoraciones permite que Google muestre rich snippets con precio y estrellas directamente en los resultados — aumentando el CTR entre un 15 y un 25%.</p>

<h2>Métricas para medir el éxito</h2>
<p>El SEO de producto tarda entre 2 y 12 semanas en mostrar resultados según la plataforma. Métricas a monitorear:</p>
<ul>
  <li><strong>Impresiones y clics en Google Search Console:</strong> valida que las fichas están siendo indexadas.</li>
  <li><strong>Posición media por producto:</strong> señal de mejora en el ranking.</li>
  <li><strong>Tasa de conversión:</strong> el objetivo final del SEO de producto es vender más.</li>
  <li><strong>Rank en marketplace:</strong> herramientas como Helium 10 monitorizan tu posición en Amazon para keywords específicas.</li>
</ul>

<p><strong>¿Tienes un catálogo que optimizar?</strong> ListWise genera fichas de producto SEO-optimizadas para cualquier plataforma. Prueba gratis con 10 productos — sin tarjeta de crédito.</p>
    `.trim(),
  },
  {
    slug: "bullet-points-amazon-que-convierten",
    title: "Cómo escribir bullet points para Amazon que convierten",
    description: "Guía con ejemplos reales para escribir los 5 puntos clave de tus listings de Amazon: estructura, longitud, formato y errores que cuestan ventas.",
    publishedAt: "2026-07-01",
    readMinutes: 6,
    category: "Guías",
    content: `
<h2>Por qué los bullet points son la parte más importante de tu listing</h2>
<p>El 80% de los compradores en Amazon decide si hace clic en "Añadir al carrito" después de leer los bullet points — antes que la descripción, antes que las fotos secundarias. Son el resumen ejecutivo de tu producto, y la mayoría de sellers los escribe mal.</p>

<h2>La estructura que convierte: Beneficio en mayúsculas + Feature</h2>
<p>Amazon permite hasta 5 bullet points de máximo 200 caracteres cada uno. La fórmula que funciona en todas las categorías es:</p>
<p><strong>BENEFICIO EN MAYÚSCULAS:</strong> la característica técnica que lo respalda, con datos concretos cuando sea posible.</p>
<p>Ejemplo real para una botella termos:</p>
<ul>
  <li>❌ Mal: "Mantiene la temperatura durante muchas horas"</li>
  <li>✅ Bien: "FRÍO 24H / CALOR 12H: doble pared de acero inoxidable 304 con vacío aislante — confirmado en pruebas a -20°C y 80°C"</li>
</ul>

<h2>Los 5 errores más comunes</h2>
<ol>
  <li><strong>Repetir el título:</strong> el primer bullet no debe duplicar información del título. Empieza donde el título termina.</li>
  <li><strong>Sin datos concretos:</strong> "alta calidad", "resistente" y "duradero" no significan nada. Medidas, materiales y certificaciones sí.</li>
  <li><strong>Superar los 200 caracteres:</strong> Amazon trunca o descarta bullets largos. Cuenta siempre antes de publicar.</li>
  <li><strong>Ignorar las objeciones del comprador:</strong> ¿Qué temen preguntarse antes de comprar? Responde en los bullets.</li>
  <li><strong>Formato de párrafo:</strong> los bullets deben empezar con mayúsculas o un identificador claro, no con "Este producto..."</li>
</ol>

<h2>Estructura recomendada para los 5 bullets</h2>
<ol>
  <li><strong>Bullet 1:</strong> propuesta de valor principal + dato técnico más diferenciador</li>
  <li><strong>Bullet 2:</strong> material, durabilidad o compatibilidad (según categoría)</li>
  <li><strong>Bullet 3:</strong> escenario de uso o público objetivo concreto</li>
  <li><strong>Bullet 4:</strong> facilidad de uso, limpieza o mantenimiento</li>
  <li><strong>Bullet 5:</strong> garantía, certificaciones o valor del pack</li>
</ol>

<h2>Cómo la IA genera bullets optimizados en segundos</h2>
<p>ListWise analiza el nombre, categoría y atributos de tu producto para generar 5 bullet points con la estructura correcta, dentro del límite de caracteres y con datos reales de tu ficha. El resultado se puede editar directamente y refinar con el Agente de Copywriting usando instrucciones en lenguaje natural.</p>
<p>Prueba gratis con 10 productos — sin tarjeta de crédito. El proceso completo tarda menos de 2 minutos.</p>
    `.trim(),
  },
  {
    slug: "errores-listings-amazon-como-evitarlos",
    title: "Los 7 errores más comunes en listings de Amazon (y cómo evitarlos)",
    description: "Análisis de los fallos que más afectan al ranking y la conversión en Amazon Seller Central, con ejemplos reales y cómo corregirlos con IA.",
    publishedAt: "2026-07-03",
    readMinutes: 8,
    category: "Amazon",
    content: `
<h2>El coste real de un listing mal optimizado</h2>
<p>Un listing con errores básicos puede costar entre un 30% y un 60% de ventas potenciales según estudios de marketplace optimization. En Amazon, donde miles de productos compiten por los mismos términos de búsqueda, los detalles marcan la diferencia entre la primera página y la quinta.</p>

<h2>Error 1: Título sin keyword principal en las primeras palabras</h2>
<p>El algoritmo A9 de Amazon pondera más las keywords que aparecen al principio del título. Si tu keyword principal ("auriculares bluetooth deportivos") está en posición 8 del título, pierdes ranking frente a competidores que la tienen en posición 1-3.</p>
<p><strong>Solución:</strong> estructura tu título como Marca + Keyword Principal + Modelo/Variante + Beneficio clave.</p>

<h2>Error 2: Bullets sin datos concretos</h2>
<p>Los bullets llenos de adjetivos ("increíble calidad", "diseño premium") no indexan keywords adicionales ni convencen al comprador. Amazon usa los bullets para indexación secundaria — cada bullet debería contener al menos un término de búsqueda relevante.</p>

<h2>Error 3: Descripción de menos de 1.000 caracteres</h2>
<p>Amazon penaliza fichas con contenido escaso. Una descripción de 200 palabras transmite autoridad y da margen para incluir variaciones de keywords que no caben en el título ni los bullets.</p>

<h2>Error 4: Backend keywords con duplicados</h2>
<p>Muchos sellers repiten en los search terms palabras que ya están en el título. Amazon ya las indexa — el espacio de 250 bytes de backend keywords debe usarse para sinónimos, errores ortográficos comunes y términos alternativos.</p>

<h2>Error 5: Imágenes sin texto alternativo SEO</h2>
<p>Amazon no indexa el texto de las imágenes, pero sí usa las palabras clave del título y bullets para decidir qué fichas mostrar en búsquedas visuales. Una ficha con fotos deficientes tiene mayor tasa de rebote, lo que penaliza el ranking.</p>

<h2>Error 6: No actualizar listings estacionales</h2>
<p>Un listing de árbol de Navidad con el mismo título en julio pierde oportunidades de búsqueda estacional. Amazon favorece fichas activamente actualizadas.</p>

<h2>Error 7: Ignorar el A+ Content en favor del tiempo</h2>
<p>Si tienes registro de marca, el A+ Content (enhanced brand content) aumenta la conversión un 5-10% de media. Muchos sellers lo dejan para después — "después" muchas veces nunca llega.</p>

<h2>Cómo corregir todos estos errores en minutos</h2>
<p>ListWise analiza tu catálogo al completo e identifica automáticamente fichas con títulos cortos, bullets sin datos o descripciones escasas. El Agente de Copywriting corrige cada punto con instrucciones en lenguaje natural: "hazlo más formal", "añade la keyword auriculares bluetooth", "acorta la descripción". Sin conocimientos técnicos de SEO necesarios.</p>
    `.trim(),
  },
  {
    slug: "herramientas-ia-ecommerce-2026",
    title: "Las mejores herramientas de IA para ecommerce en 2026",
    description: "Comparativa de las herramientas de inteligencia artificial para tiendas online en 2026: generación de contenido, atención al cliente, personalización y análisis de competencia.",
    publishedAt: "2026-07-06",
    readMinutes: 9,
    category: "IA & Tendencias",
    content: `
<h2>El ecommerce cambió para siempre en 2024-2025</h2>
<p>Los modelos de lenguaje de gran tamaño (LLMs) pasaron de ser una curiosidad tecnológica a convertirse en infraestructura crítica para las tiendas online más eficientes. En 2026, la pregunta ya no es "¿debería usar IA?" sino "¿qué herramientas están realmente funcionando y cuáles son ruido?"</p>

<h2>Categoría 1: Generación de contenido de producto</h2>
<p>Esta es la aplicación con mayor ROI inmediato para la mayoría de sellers. Escribir títulos SEO, bullet points y descripciones optimizadas para cientos de productos manualmente es inviable — la IA lo hace en minutos.</p>
<ul>
  <li><strong>ListWise:</strong> especializado en marketplace listings (Amazon, Etsy, Shopify). Procesa CSVs completos y genera título + bullets + descripción optimizados por categoría. Agente de copywriting para refinamiento iterativo.</li>
  <li><strong>Jasper / Copy.ai:</strong> generalistas. Buenos para texto de marketing pero sin conocimiento específico de marketplaces ni formatos de listing.</li>
  <li><strong>ChatGPT (GPT-4o):</strong> versátil pero requiere prompts muy elaborados para llegar a la calidad de herramientas especializadas. Sin integración con CSVs ni exportación masiva.</li>
</ul>

<h2>Categoría 2: Atención al cliente automatizada</h2>
<p>Los chatbots de nueva generación (Intercom Fin, Zendesk AI, Tidio) resuelven entre el 40% y el 70% de consultas sin intervención humana. El ROI es claro: reducción de costes de soporte con mejora de tiempos de respuesta.</p>

<h2>Categoría 3: Personalización de la experiencia</h2>
<p>Herramientas como Dynamic Yield o Nosto analizan el comportamiento del usuario para personalizar la página de inicio, los correos de carrito abandonado y las recomendaciones de producto. El incremento medio en conversión es del 15-25%.</p>

<h2>Categoría 4: Análisis de competencia</h2>
<p>La IA permite monitorizar cambios de precios, nuevos listings y tendencias de búsqueda de competidores en tiempo real. ListWise incluye un módulo de análisis de competencia que identifica las keywords que usan los productos mejor posicionados en tu categoría.</p>

<h2>Categoría 5: Forecasting de inventario</h2>
<p>Modelos predictivos basados en ventas históricas, estacionalidad y tendencias de Google permiten optimizar el stock y reducir tanto el exceso como las roturas. Herramientas: Inventory Planner, Skubana.</p>

<h2>Conclusión: especialización vs. plataformas todo-en-uno</h2>
<p>Las herramientas especializadas superan a las generalistas en cada categoría específica. Un stack de 3-4 herramientas especializadas (contenido de producto, atención al cliente, personalización, inventario) tiene mejor ROI que una plataforma todo-en-uno que hace todo regular.</p>
<p>Empieza por donde el impacto es mayor: si tienes más de 50 productos sin optimizar, el contenido de listing es el primer paso. <a href="/sign-up">Prueba ListWise gratis</a> — 10 productos sin tarjeta.</p>
    `.trim(),
  },
  {
    slug: "palabras-clave-ecommerce-guia-completa",
    title: "Palabras clave para ecommerce: cómo encontrarlas y usarlas",
    description: "Guía completa de keyword research para tiendas online: herramientas, tipos de keywords, dónde colocarlas en tus fichas de producto y cómo medirlo.",
    publishedAt: "2026-07-09",
    readMinutes: 10,
    category: "SEO",
    content: `
<h2>Por qué el keyword research de ecommerce es diferente</h2>
<p>El keyword research para una tienda online no funciona igual que para un blog. Los compradores usan términos con intención de compra clara: "comprar auriculares bluetooth baratos", "zapatillas running mujer talla 38", "jarron ceramica azul decoracion". Capturar esas búsquedas transaccionales es lo que genera ventas, no las búsquedas informacionales.</p>

<h2>Los 3 tipos de keywords para producto</h2>
<ol>
  <li><strong>Head terms:</strong> términos genéricos de alta competencia ("auriculares bluetooth"). Alto volumen, baja conversión. Difíciles de rankear para tiendas pequeñas.</li>
  <li><strong>Long-tail transaccional:</strong> "auriculares bluetooth deportivos resistentes agua bajo 30 euros". Menor volumen, conversión muy alta. Ideal para fichas de producto específicas.</li>
  <li><strong>Long-tail de marca:</strong> "auriculares Sony WH-1000XM5 precio españa". Baja competencia, alta intención de compra.</li>
</ol>

<h2>Herramientas para encontrar keywords de producto</h2>
<ul>
  <li><strong>Google Keyword Planner:</strong> gratuito, datos directos de Google. Ideal para tiendas con web propia o Shopify.</li>
  <li><strong>Helium 10 / Jungle Scout:</strong> especializados en Amazon. Muestran volumen de búsqueda en Amazon, no en Google.</li>
  <li><strong>Ahrefs / SEMrush:</strong> los más completos para análisis competitivo. De pago, pero imprescindibles para tiendas con tráfico orgánico serio.</li>
  <li><strong>Amazon Autocompletar:</strong> gratis y muy revelador. Escribe tu keyword en la barra de búsqueda y analiza las sugerencias — representan búsquedas reales de compradores.</li>
  <li><strong>AnswerThePublic:</strong> útil para descubrir preguntas frecuentes de compradores que se pueden responder en la descripción del producto.</li>
</ul>

<h2>Dónde colocar las keywords en tu listing</h2>
<ol>
  <li><strong>Título:</strong> keyword principal en las primeras 5 palabras. En Amazon, máximo 200 caracteres.</li>
  <li><strong>Bullet points:</strong> 1-2 keywords secundarias por bullet, en contexto natural.</li>
  <li><strong>Descripción:</strong> densidad de keyword del 1-2%. No fuerces — el texto debe leerse bien.</li>
  <li><strong>Backend keywords (Amazon):</strong> sinónimos, errores ortográficos comunes, términos alternativos.</li>
  <li><strong>Nombre del archivo de imagen:</strong> "auriculares-bluetooth-deportivos-negro.jpg" en lugar de "IMG_1234.jpg". Impacta en Google Images.</li>
</ol>

<h2>Cómo ListWise gestiona las keywords automáticamente</h2>
<p>Al generar un listing, ListWise extrae la keyword principal del nombre del producto, la categoría y los atributos disponibles. La coloca automáticamente en la posición correcta del título y la distribuye naturalmente en bullets y descripción. El campo "Keyword principal" que aparece en el dashboard es la keyword que el sistema ha identificado como más relevante para ese producto.</p>
<p>Si quieres insertar una keyword específica, el Agente de Copywriting lo hace con una instrucción como "Optimiza para SEO: inserta 'auriculares bluetooth deportivos' como keyword principal".</p>
    `.trim(),
  },
  {
    slug: "optimizar-listings-etsy-ia",
    title: "Cómo optimizar tus listings de Etsy con IA en 2026",
    description: "Guía específica para vendedores de Etsy: cómo usar la inteligencia artificial para mejorar títulos, tags y descripciones y aumentar la visibilidad en búsquedas de Etsy.",
    publishedAt: "2026-07-12",
    readMinutes: 7,
    category: "Guías",
    content: `
<h2>El algoritmo de búsqueda de Etsy vs. Amazon</h2>
<p>Etsy y Amazon comparten la mecánica básica del marketplace: el algoritmo recompensa fichas con keywords relevantes, buenas imágenes y ventas consistentes. Pero hay diferencias clave que cambian cómo debes escribir tus listings.</p>
<p>En Etsy, el buyer espera un tono personal, artesanal y emocional. Un título de listing en Etsy que suene corporativo convierte peor, aunque posicione igual de bien. La historia del producto y del creador forma parte de la propuesta de valor.</p>

<h2>Estructura del título de Etsy</h2>
<p>Etsy permite hasta 140 caracteres de título. El algoritmo de Etsy es especialmente sensible a las keywords del título para búsquedas. La estructura recomendada:</p>
<p><strong>[Keyword principal], [keyword secundaria], [material o técnica], [uso o destinatario]</strong></p>
<p>Ejemplo: "Taza cerámica hecha a mano, cerámica artesanal azul, regalo para ella, vajilla boho"</p>
<p>Fíjate en que las keywords están separadas por comas — Etsy trata cada segmento como un término de búsqueda independiente.</p>

<h2>Los tags: el factor más subestimado</h2>
<p>Etsy permite 13 tags por listing de hasta 20 caracteres cada uno. Los tags son prácticamente keywords de búsqueda directas. Muchos vendedores los rellenan con palabras genéricas ("regalo", "hecho a mano") en lugar de frases long-tail específicas.</p>
<p>Mejor práctica: usa los 13 tags para frases de 2-4 palabras que describen el producto desde diferentes ángulos: el uso, el destinatario, el estilo, el material, la ocasión, el tamaño.</p>

<h2>La descripción en Etsy: más larga que en Amazon</h2>
<p>En Etsy, una descripción de 300-500 palabras funciona mejor que una corta. Etsy indexa el contenido de la descripción para búsquedas long-tail, y los compradores de Etsy leen más antes de comprar — quieren conocer la historia del producto.</p>
<p>Estructura recomendada para la descripción de Etsy:</p>
<ol>
  <li>Párrafo 1: describe el producto y su propuesta de valor emocional (2-3 frases)</li>
  <li>Párrafo 2: materiales, proceso de fabricación y detalles técnicos</li>
  <li>Párrafo 3: usos, ocasiones y a quién va dirigido</li>
  <li>Párrafo 4: información práctica (dimensiones, variantes disponibles, tiempo de fabricación)</li>
  <li>Párrafo 5: política de la tienda y contact information</li>
</ol>

<h2>Cómo ListWise genera listings optimizados para Etsy</h2>
<p>ListWise tiene un modo específico para Etsy que adapta el tono, la estructura del título (con comas entre keywords), la longitud de la descripción y el estilo narrativo. Al seleccionar "Etsy" en el selector de plataforma, el sistema genera automáticamente contenido con el tono artesanal y personal que espera el comprador de Etsy.</p>
<p>El Agente de Copywriting también permite ajustes finos: "hazlo más emocional", "añade la keyword cerámica artesanal al título", "escribe desde la perspectiva del creador".</p>
    `.trim(),
  },
  {
    slug: "plantilla-csv-listings-productos-descarga",
    title: "Plantilla CSV para listings de productos: guía y descarga gratuita",
    description: "Descarga gratis la plantilla CSV para subir tus productos a ListWise y generar títulos, bullet points y descripciones optimizadas con IA. Explica cada columna con ejemplos.",
    publishedAt: "2026-07-15",
    readMinutes: 5,
    category: "Recursos",
    content: `
<h2>Por qué un CSV bien rellenado marca la diferencia</h2>
<p>La calidad del listing generado por IA depende directamente de la información que le das. Un producto con solo nombre y categoría generará un listing genérico. El mismo producto con materiales, medidas, público objetivo y atributos específicos generará contenido que puede competir con el mejor copywriter humano.</p>
<p>El CSV de ListWise está diseñado para capturar exactamente la información que la IA necesita para cada categoría de producto.</p>

<h2>Columnas de la plantilla CSV de ListWise</h2>
<ul>
  <li><strong>productName (obligatorio):</strong> nombre del producto tal como aparecerá en el listing. Cuanto más específico, mejor. "Auriculares bluetooth" es peor que "Auriculares Bluetooth 5.3 deportivos IPX7".</li>
  <li><strong>category (obligatorio):</strong> categoría del producto. Ejemplos: Electrónica, Moda, Hogar, Belleza, Deporte. Activa reglas de copywriting específicas para cada categoría.</li>
  <li><strong>price (opcional):</strong> precio del producto. Permite al sistema calibrar el tono (premium vs. económico).</li>
  <li><strong>material (opcional):</strong> materiales principales. Ejemplo: "Acero inoxidable 304, silicona alimentaria". Fundamental para productos de hogar, moda y alimentación.</li>
  <li><strong>attributes (opcional):</strong> características adicionales separadas por punto y coma. Ejemplo: "Capacidad: 500ml; Color: Negro mate; Garantía: 2 años; Certificación: CE".</li>
  <li><strong>targetAudience (opcional):</strong> a quién va dirigido. Ejemplo: "Deportistas, runners, ciclistas".</li>
  <li><strong>keywords (opcional):</strong> keywords específicas que quieres incluir obligatoriamente en el título o bullets.</li>
</ul>

<h2>Cómo descargar la plantilla</h2>
<p>Puedes descargar la plantilla CSV directamente desde ListWise una vez que inicias sesión, en el dashboard principal usando el botón "Plantilla CSV" del menú de navegación. El archivo incluye una fila de ejemplo con todos los campos rellenados para que sirva de referencia.</p>

<h2>Consejos para rellenar el CSV eficientemente</h2>
<ol>
  <li><strong>Exporta desde tu sistema de gestión:</strong> si usas Odoo, WooCommerce o un ERP, exporta el catálogo directamente y adapta las columnas. No hace falta rellenarlo a mano.</li>
  <li><strong>El campo attributes es tu mejor aliado:</strong> cuantos más atributos específicos incluyas, mejor será el resultado. Copia la ficha técnica del fabricante.</li>
  <li><strong>Agrupa por categoría:</strong> procesa productos de la misma categoría juntos — la IA aplica las reglas de copywriting más relevantes por lote.</li>
  <li><strong>Prueba con 5-10 productos primero:</strong> antes de subir un catálogo de 500 productos, valida la calidad del resultado con una muestra pequeña y ajusta los atributos.</li>
</ol>

<p>¿Listo para generar tus listings? <a href="/sign-up">Regístrate gratis</a> y obtén 10 generaciones gratuitas sin tarjeta de crédito.</p>
    `.trim(),
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return posts.find((p) => p.slug === slug);
}
