import { sql } from "drizzle-orm";
import { db } from "@/db";
import { user as userTable } from "@/db/auth-schema";
import { doctorProfile } from "@/db/schema";
import { apiError, json, requireAdmin } from "@/lib/api-utils";

// ─── GET /api/stats ──────────────────────────────────────────────────────────

export async function GET() {
	try {
		await requireAdmin();

		const [totalResult] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(userTable);
		const [adminsResult] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(userTable)
			.where(sql`${userTable.accessId} >= 2`);

		const [verifiedResult] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(doctorProfile)
			.where(sql`${doctorProfile.status} = 'verified'`);

		const [pendingResult] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(doctorProfile)
			.where(sql`${doctorProfile.status} = 'pending'`);

		const [rejectedResult] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(doctorProfile)
			.where(sql`${doctorProfile.status} = 'rejected'`);

		const [bannedResult] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(doctorProfile)
			.where(sql`${doctorProfile.status} = 'banned'`);

		return json({
			total: totalResult.count,
			admins: adminsResult.count,
			verified: verifiedResult.count,
			pending: pendingResult.count,
			rejected: rejectedResult.count,
			banned: bannedResult.count,
		});
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}
