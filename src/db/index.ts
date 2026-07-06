import "@/lib/env"; // validates all required env vars at startup (throws on missing vars)
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";
import { log } from "@/lib/logger";

export { schema };

type Db = ReturnType<typeof drizzle<typeof schema>>;

let _instance: Db | undefined;

function getInstance(): Db {
  if (_instance) return _instance;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error("Missing env vars: TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
  }

  _instance = drizzle(createClient({ url, authToken }), { schema });
  log.debug("DB connection established");
  return _instance;
}

export const db = new Proxy({} as Db, {
  get(_target, prop: string | symbol) {
    const instance = getInstance();
    const value = Reflect.get(instance, prop);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
