import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

export { schema };

type Db = ReturnType<typeof drizzle<typeof schema>>;

let _instance: Db | undefined;

function getInstance(): Db {
  if (_instance) return _instance;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error("❌ Faltan variables de entorno: TURSO_DATABASE_URL o TURSO_AUTH_TOKEN");
  }

  _instance = drizzle(createClient({ url, authToken }), { schema });
  return _instance;
}

// Proxy: misma API que antes, pero la conexión se crea solo en el primer uso real
export const db = new Proxy({} as Db, {
  get(_target, prop: string | symbol) {
    return getInstance()[prop as keyof Db];
  },
});
