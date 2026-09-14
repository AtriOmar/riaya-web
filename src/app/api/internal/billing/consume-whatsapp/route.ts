// POST /api/internal/billing/consume-whatsapp
// Called by the voice service before sending WhatsApp (when quota was not
// already consumed by a web route).

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { doctorProfile } from "@/db/schema";
import { json, requireInternal, validationError } from "@/lib/api-utils";
import { apiError } from "@/lib/errors";
import { assertAndRecordWhatsappSend } from "@/lib/plan-limits";

const bodySchema = z
	.object({
		doctorId: z.number().int().positive().optional(),
		userId: z.string().min(1).optional(),
		count: z.number().int().positive().optional().default(1),
	})
	.refine((b) => b.doctorId != null || b.userId != null, {
		message: "doctorId or userId required",
	});

export async function POST(req: Request) {
	try {
		await requireInternal(req);
		const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
		if (!parsed.success) return validationError(parsed.error.issues);

		let doctorId = parsed.data.doctorId;
		if (doctorId == null) {
			const [profile] = await db
				.select({ id: doctorProfile.id })
				.from(doctorProfile)
				.where(eq(doctorProfile.userId, parsed.data.userId!));
			if (!profile) return apiError("DOCTOR_PROFILE_NOT_FOUND");
			doctorId = profile.id;
		}

		await assertAndRecordWhatsappSend(doctorId, parsed.data.count);
		return json({ ok: true, doctorId });
	} catch (err) {
		if (err instanceof Response) return err;
		console.error("[consume-whatsapp]", err);
		return apiError("INTERNAL_ERROR");
	}
}
