import { db } from "@/server/db";
import { sql } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ready = searchParams.get("ready");

  if (ready !== null) {
    try {
      await db.execute(sql`SELECT 1`);
      return Response.json({ status: "ready" });
    } catch {
      return Response.json({ status: "not ready" }, { status: 503 });
    }
  }

  return Response.json({ status: "ok" });
}
