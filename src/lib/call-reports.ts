import { and, count, inArray } from "drizzle-orm";
import { db } from "@/db";
import { blockedPhone, call, callReport } from "@/db/schema";
import { activeBlock } from "@/lib/blocked-phone";

export type NumberContext = {
	reportCount: number;
	callCount: number;
	blocked: boolean;
};

/** Per number: how often it was reported, how often it called, and whether it is blocked now. */
export async function getNumberContexts(
	phones: string[],
): Promise<Map<string, NumberContext>> {
	const unique = [...new Set(phones)];
	const result = new Map<string, NumberContext>(
		unique.map((p) => [p, { reportCount: 0, callCount: 0, blocked: false }]),
	);
	if (unique.length === 0) return result;

	const [reports, calls, blocks] = await Promise.all([
		db
			.select({ phone: callReport.phoneNumber, n: count() })
			.from(callReport)
			.where(inArray(callReport.phoneNumber, unique))
			.groupBy(callReport.phoneNumber),
		db
			.select({ phone: call.from, n: count() })
			.from(call)
			.where(inArray(call.from, unique))
			.groupBy(call.from),
		db
			.select({ phone: blockedPhone.phoneNumber })
			.from(blockedPhone)
			.where(and(inArray(blockedPhone.phoneNumber, unique), activeBlock)),
	]);

	for (const r of reports) {
		const ctx = result.get(r.phone);
		if (ctx) ctx.reportCount = r.n;
	}
	for (const c of calls) {
		const ctx = c.phone ? result.get(c.phone) : undefined;
		if (ctx) ctx.callCount = c.n;
	}
	for (const b of blocks) {
		const ctx = result.get(b.phone);
		if (ctx) ctx.blocked = true;
	}
	return result;
}
