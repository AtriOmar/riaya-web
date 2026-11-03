import type { NextRequest } from "next/server";
import {
	apiError,
	json,
	requireDoctorProfile,
	requireSession,
	validationError,
} from "@/lib/api-utils";
import {
	noteLanguageResponseSchema,
	noteLanguageSchema,
	setNoteLanguage,
} from "@/lib/note-language";
import { registry } from "@/lib/openapi";

// ─── PUT /api/doctors/me/note-language ────────────────────────────────────────
// The doctor picks the language of their AI consultation notes. Notes already
// written are not rewritten.

export async function PUT(req: NextRequest) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const parsed = noteLanguageSchema.safeParse(await req.json());
		if (!parsed.success) return validationError(parsed.error.issues);

		const updated = await setNoteLanguage(profile.id, parsed.data.noteLanguage);
		if (!updated) return apiError("DOCTOR_PROFILE_NOT_FOUND");
		return json(updated);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "put",
	path: "/api/doctors/me/note-language",
	tags: ["Doctors"],
	summary: "Set the language of the doctor's AI consultation notes",
	request: {
		body: { content: { "application/json": { schema: noteLanguageSchema } } },
	},
	responses: {
		200: {
			description: "Saved language",
			content: {
				"application/json": { schema: noteLanguageResponseSchema },
			},
		},
	},
});
