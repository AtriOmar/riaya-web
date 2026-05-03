import { asc } from "drizzle-orm";
import { db } from "@/db";
import { cities } from "@/db/schema";
import { apiError, json } from "@/lib/api-utils";

// ─── GET /api/cities ──────────────────────────────────────────────────────────

export async function GET() {
	try {
		const rows = await db.select().from(cities).orderBy(asc(cities.enName));
		return json(rows);
	} catch {
		return apiError("INTERNAL_ERROR");
	}
}
