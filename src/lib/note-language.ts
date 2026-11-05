import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { doctorProfile } from "@/db/schema";
import { languages } from "@/lib/language";

export const noteLanguageSchema = z.object({
	noteLanguage: z.enum(languages),
});

export const noteLanguageResponseSchema = noteLanguageSchema;

/** Saves the language the AI writes this doctor's consultation notes in. */
export async function setNoteLanguage(
	doctorId: number,
	noteLanguage: z.infer<typeof noteLanguageSchema>["noteLanguage"],
) {
	const [updated] = await db
		.update(doctorProfile)
		.set({ noteLanguage, updatedAt: new Date() })
		.where(eq(doctorProfile.id, doctorId))
		.returning({ noteLanguage: doctorProfile.noteLanguage });
	return updated ?? null;
}
