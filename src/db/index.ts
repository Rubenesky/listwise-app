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

  console.log(`[DB] TURSO_DATABASE_URL: ${url ? "✅ presente" : "❌ ausente"}`);
  console.log(`[DB] TURSO_AUTH_TOKEN: ${authToken ? "✅ presente" : "❌ ausente"}`);

  if (!url || !authToken) {
    throw new Error("❌ Faltan variables de entorno: TURSO_DATABASE_URL o TURSO_AUTH_TOKEN");
  }

  _instance = drizzle(createClient({ url, authToken }), { schema });
  console.log("[DB] ✅ Conexión a Turso establecida");
  return _instance;
}

export const db = new Proxy({} as Db, {
  get(_target, prop: string | symbol) {
    const instance = getInstance();
    const value = Reflect.get(instance, prop);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
