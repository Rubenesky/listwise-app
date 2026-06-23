import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  throw new Error("❌ Faltan variables de entorno: TURSO_DATABASE_URL o TURSO_AUTH_TOKEN");
}

const client = createClient({ url, authToken });

export const db = drizzle(client, { schema });
export { schema };