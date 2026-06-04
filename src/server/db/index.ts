import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db) {
    const queryClient = postgres(process.env.DATABASE_URL!, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    _db = drizzle(queryClient, { schema });
  }
  return _db;
}

// Backward-compatible `db` getter
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop, receiver) {
    const real = getDb();
    const val = Reflect.get(real, prop, receiver);
    return typeof val === "function" ? val.bind(real) : val;
  },
});
