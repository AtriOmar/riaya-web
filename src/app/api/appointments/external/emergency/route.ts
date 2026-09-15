import type { NextRequest } from "next/server";
import { z } from "zod";
import { selectAppointmentSchema } from "@/db/zod";
import { apiError, json, validationError } from "@/lib/api-utils";
import { bookEmergencyAppointments } from "@/lib/emergency-appointments";
import { registry } from "@/lib/openapi";
import { scheduleEmergencyPendingTimeout } from "@/lib/pending-appointment-timeout";
import { upsertPersonByPhone } from "@/lib/person";
import { normalizePhoneForStorage } from "@/lib/phone";

// ─── POST /api/appointments/external/emergency ───────────────────────────────
// Public — fan-out urgent pending appointments to the top ASAP best-fit doctors.
// When one doctor accepts, siblings in the same emergencyGroupId are cancelled.

const emergencySchema = z.object({
	speciality: z.string().min(1),
	lat: z.coerce.number(),
	long: z.coerce.number(),
	name: z.string().min(1),
	phoneNumber: z.string().min(1, "Phone number is required"),
	illness: z.string().min(1),
});

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const parsed = emergencySchema.safeParse(body);
		if (!parsed.success) return validationError(parsed.error.issues);

		const normalizedPhone = normalizePhoneForStorage(parsed.data.phoneNumber);
		if (!normalizedPhone) {
			return validationError([
				{ message: "Invalid phone number", path: ["phoneNumber"] },
			]);
		}

		void upsertPersonByPhone(normalizedPhone, "call");

		const result = await bookEmergencyAppointments({
			speciality: parsed.data.speciality,
			lat: parsed.data.lat,
			long: parsed.data.long,
			name: parsed.data.name,
			phoneNumber: normalizedPhone,
			illness: parsed.data.illness,
		});

		if (!result.specialityFound) return apiError("SPECIALITY_NOT_FOUND");

		if (result.created.length === 0) {
			return json(
				{
					found: false,
					message: "No nearby doctors with available slots were found.",
					appointments: [],
				},
				200,
			);
		}

		if (result.emergencyGroupId) {
			void scheduleEmergencyPendingTimeout({
				emergencyGroupId: result.emergencyGroupId,
			}).catch((err) =>
				console.error(
					"[appointments/external/emergency] schedule pending timeout",
					err,
				),
			);
		}

		return json(
			{
				found: true,
				emergencyGroupId: result.emergencyGroupId,
				appointments: result.created,
				doctors: result.doctors,
				message: `Created ${result.created.length} urgent pending appointment(s). The first doctor to accept keeps the booking; the others are cancelled automatically.`,
			},
			201,
		);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "post",
	path: "/api/appointments/external/emergency",
	tags: ["Appointments"],
	summary: "Book urgent emergency appointments (fan-out to top doctors)",
	request: {
		body: { content: { "application/json": { schema: emergencySchema } } },
	},
	responses: {
		201: {
			description: "Urgent appointments created",
			content: {
				"application/json": {
					schema: z.object({
						found: z.boolean(),
						emergencyGroupId: z.string().optional(),
						appointments: z.array(selectAppointmentSchema),
						doctors: z.array(z.any()).optional(),
						message: z.string().optional(),
					}),
				},
			},
		},
	},
});
