import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { doctorProfile } from "@/db/schema";

export const cabinetAddressSchema = z.object({
	cabinetAddress: z.string().trim().min(1).max(500),
});

export const cabinetAddressResponseSchema = cabinetAddressSchema;

/** Saves the street address the voice agent and invoices give for a cabinet. */
export async function setCabinetAddress(doctorId: number, address: string) {
	const [updated] = await db
		.update(doctorProfile)
		.set({ cabinetAddress: address, updatedAt: new Date() })
		.where(eq(doctorProfile.id, doctorId))
		.returning({ cabinetAddress: doctorProfile.cabinetAddress });
	return updated ?? null;
}
