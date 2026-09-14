// GET /api/billing/invoices — list the authenticated doctor's billing invoices
// GET /api/billing/subscription — get the authenticated doctor's subscription

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { billingInvoice } from "@/db/schema";
import { getDoctorProfile, json, requireSession } from "@/lib/api-utils";
import { apiError } from "@/lib/errors";

export async function GET() {
	try {
		const session = await requireSession();
		const profile = await getDoctorProfile(session.user.id);
		if (!profile) return apiError("DOCTOR_PROFILE_NOT_FOUND");

		const invoices = await db
			.select()
			.from(billingInvoice)
			.where(eq(billingInvoice.doctorId, profile.id))
			.orderBy(desc(billingInvoice.createdAt));

		return json(invoices);
	} catch (err) {
		if (err instanceof Response) return err;
		console.error("[billing/invoices GET]", err);
		return apiError("INTERNAL_ERROR");
	}
}
