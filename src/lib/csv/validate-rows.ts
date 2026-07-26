export const SUPPORTED_CATEGORIES = new Set([
  "ropa", "moda", "calzado", "accesorios", "complementos",
  "electrónica", "electronica", "tecnología", "tecnologia",
  "informática", "informatica", "teléfonos", "telefonos", "tablets",
  "hogar", "cocina", "decoración", "decoracion", "muebles",
  "iluminación", "iluminacion", "jardín", "jardin", "baño", "bano",
  "deportes", "fitness", "outdoor", "ciclismo", "natación", "natacion",
  "alimentación", "alimentacion", "bebidas", "gourmet", "dietética",
  "dietetica", "suplementos",
  "cosmética", "cosmetica", "belleza", "perfumes", "salud",
  "bienestar", "farmacia",
  "juguetes", "bebé", "bebe", "bebés", "bebes", "niños", "ninos", "juegos",
  "libros", "librería", "libreria", "arte", "música", "musica",
  "películas", "peliculas", "series",
  "mascotas", "animales",
  "automoción", "automocion", "automóvil", "automovil", "motos",
  "bicicletas",
  "viajes", "turismo",
  "oficina", "papelería", "papeleria", "escuela",
  "joyería", "joyeria", "bisutería", "bisuteria", "relojes",
  "fotografía", "fotografia", "cámaras", "camaras",
  "videojuegos", "gaming", "consolas",
]);

export const PRICE_RE = /^[€$£¥]?\s*\d{1,10}([.,]\d{1,3})*([.,]\d{1,2})?\s*[€$£¥]?$/;

export function isValidPrice(raw: string): boolean {
  return PRICE_RE.test(raw.trim());
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export function validateRows(records: Record<string, string>[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const MAX_ERRORS = 20;

  if (records.length === 0) return { errors, warnings };

  const headers = Object.keys(records[0]);

  if (!headers.includes("productName")) {
    errors.push('El CSV debe incluir la columna "productName"');
    return { errors, warnings };
  }

  const hasPrice = headers.includes("price");
  const hasCategory = headers.includes("category");

  for (let i = 0; i < records.length && errors.length < MAX_ERRORS; i++) {
    const row = i + 2;
    const record = records[i];

    const name = record.productName?.trim() ?? "";
    if (!name) {
      errors.push(`Fila ${row}: el nombre del producto es obligatorio`);
    } else if (name.length > 500) {
      errors.push(
        `Fila ${row}: el nombre del producto es demasiado largo ` +
        `(${name.length} caracteres, máximo 500)`
      );
    }

    if (hasPrice && record.price?.trim()) {
      if (!isValidPrice(record.price)) {
        errors.push(
          `Fila ${row}: formato de precio no válido — "${record.price}" ` +
          `(usa formato numérico como "29.99" o "29,99€")`
        );
      }
    }

    if (hasCategory && record.category?.trim()) {
      const normalized = record.category.trim().toLowerCase();
      if (!SUPPORTED_CATEGORIES.has(normalized)) {
        warnings.push(
          `Fila ${row}: categoría "${record.category}" no está en la lista de ` +
          `categorías conocidas — se procesará igualmente`
        );
      }
    }

    if (record.attributes?.trim()) {
      try {
        JSON.parse(record.attributes);
      } catch {
        warnings.push(
          `Fila ${row}: los atributos no son JSON válido — se ignorarán durante el procesamiento`
        );
      }
    }

    if (record.sourceUrl?.trim()) {
      try {
        const parsedUrl = new URL(record.sourceUrl.trim());
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
          warnings.push(
            `Fila ${row}: sourceUrl debe empezar por http:// o https:// — se ignorará`
          );
        }
      } catch {
        warnings.push(`Fila ${row}: sourceUrl no es una URL válida — se ignorará`);
      }
    }
  }

  if (errors.length >= MAX_ERRORS) {
    errors.push(`... y más errores. Corrige los primeros ${MAX_ERRORS} y vuelve a subir.`);
  }

  return { errors, warnings };
}
