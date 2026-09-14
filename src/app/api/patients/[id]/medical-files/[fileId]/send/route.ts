import axios from "axios";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { patient, patientMedicalFile } from "@/db/schema";
import {
	apiError,
	json,
	requireDoctorProfile,
	requireSession,
} from "@/lib/api-utils";
import { resolvePreferredLanguage } from "@/lib/person";
import { assertAndRecordWhatsappSend } from "@/lib/plan-limits";
import { getRealtimeHttpUrl } from "@/lib/realtime";
import {
	buildMedicalFileWhatsappCaption,
	buildMedicalFileWhatsappText,
} from "@/lib/whatsapp-messages";

// ─── POST /api/patients/[id]/medical-files/[fileId]/send ──────────────────────

export async function POST(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string; fileId: string }> },
) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const { id, fileId } = await params;
		const patientId = Number(id);
		const medicalFileId = Number(fileId);
		if (Number.isNaN(patientId) || Number.isNaN(medicalFileId))
			return apiError("INVALID_ID");

		// Verify patient belongs to this doctor
		const foundPatient = await db.query.patient.findFirst({
			where: and(eq(patient.id, patientId), eq(patient.doctorId, profile.id)),
			with: { person: true },
		});

		if (!foundPatient) return apiError("PATIENT_NOT_FOUND");
		if (!foundPatient.phoneNumber) {
			return new Response(
				JSON.stringify({
					error: "Patient does not have a phone number linked.",
				}),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Verify medical file belongs to patient
		const [foundFile] = await db
			.select({
				id: patientMedicalFile.id,
				documents: patientMedicalFile.documents,
				title: patientMedicalFile.title,
				description: patientMedicalFile.description,
			})
			.from(patientMedicalFile)
			.where(
				and(
					eq(patientMedicalFile.id, medicalFileId),
					eq(patientMedicalFile.patientId, patientId),
				),
			);

		if (!foundFile) return apiError("MEDICAL_FILE_NOT_FOUND");

		const httpUrl = getRealtimeHttpUrl();
		if (!httpUrl) {
			console.error("NEXT_PUBLIC_REALTIME_URL is not set");
			return apiError("INTERNAL_ERROR");
		}

		try {
			const docUrls =
				foundFile.documents?.filter((u): u is string => !!u) ?? [];
			const sendCount = docUrls.length > 0 ? docUrls.length + 1 : 1;
			await assertAndRecordWhatsappSend(profile.id, sendCount);

			const language = await resolvePreferredLanguage({
				preferredLanguage: foundPatient.person?.preferredLanguage,
				phone: foundPatient.phoneNumber,
			});

			if (docUrls.length > 0) {
				await axios.post(`${httpUrl}/send-whatsapp`, {
					userId: session.user.id,
					phone: foundPatient.phoneNumber,
					message: buildMedicalFileWhatsappCaption({
						language,
						patientFirstName: foundPatient.firstName,
						doctorFirstName: profile.firstName,
						doctorLastName: profile.lastName,
						title: foundFile.title,
					}),
					quotaConsumed: true,
				});

				for (let i = 0; i < docUrls.length; i++) {
					const documentUrl = docUrls[i];

					// Extract extension from URL, e.g. .jpg, .png, .pdf
					const pathOnly = documentUrl.split("?")[0].split("#")[0];
					const ext = pathOnly.split(".").pop()?.toLowerCase() || "pdf";

					let mimetype = "application/pdf";
					if (["jpg", "jpeg"].includes(ext)) mimetype = "image/jpeg";
					else if (ext === "png") mimetype = "image/png";
					else if (ext === "webp") mimetype = "image/webp";

					const baseName = foundFile.title
						? `${foundFile.title}${docUrls.length > 1 ? ` - ${i + 1}` : ""}`
						: `Document ${i + 1}`;
					const fileName = `${baseName}.${ext}`;

					await axios.post(`${httpUrl}/send-whatsapp`, {
						userId: session.user.id,
						phone: foundPatient.phoneNumber,
						documentUrl: documentUrl,
						fileName: fileName,
						mimetype: mimetype,
						quotaConsumed: true,
					});
				}
			} else {
				// Send text-only message
				const textMessage = buildMedicalFileWhatsappText({
					language,
					patientFirstName: foundPatient.firstName,
					doctorFirstName: profile.firstName,
					doctorLastName: profile.lastName,
					title: foundFile.title,
					description: foundFile.description,
				});
				await axios.post(`${httpUrl}/send-whatsapp`, {
					userId: session.user.id,
					phone: foundPatient.phoneNumber,
					message: textMessage,
					quotaConsumed: true,
				});
			}
		} catch (err: unknown) {
			if (err instanceof Response) return err;
			const ax = err as { response?: { data?: unknown }; message?: string };
			console.error(
				"Failed to send WhatsApp document:",
				ax?.response?.data || ax?.message,
			);
			return apiError("WHATSAPP_SEND_FAILED");
		}

		// Update DB to mark as sent
		const [updated] = await db
			.update(patientMedicalFile)
			.set({ sentViaWhatsapp: true })
			.where(eq(patientMedicalFile.id, medicalFileId))
			.returning();

		return json(updated);
	} catch (e) {
		if (e instanceof Response) return e;
		console.error(e);
		return apiError("INTERNAL_ERROR");
	}
}

import { registry } from "@/lib/openapi";

const paramsSchema = z.object({ id: z.string(), fileId: z.string() });

registry.registerPath({
	method: "post",
	path: "/api/patients/{id}/medical-files/{fileId}/send",
	tags: ["Patients"],
	summary: "Send medical file via WhatsApp",
	request: { params: paramsSchema },
	responses: {
		200: {
			description: "Sent successfully",
			content: { "application/json": { schema: z.any() } },
		},
	},
});
