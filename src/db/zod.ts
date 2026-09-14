import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import {
	aiChatConversation,
	aiChatMessage,
	appointment,
	call,
	callEvent,
	cities,
	consultationRecording,
	doctorApplication,
	doctorProfile,
	invoice,
	invoiceItem,
	invoicePayment,
	patient,
	patientMedicalFile,
	person,
	review,
	speciality,
	user,
} from "./schema";

export const selectSpecialitySchema = createSelectSchema(speciality);
export const selectCitiesSchema = createSelectSchema(cities);
export const selectDoctorProfileSchema = createSelectSchema(doctorProfile);
export const selectPersonSchema = createSelectSchema(person);
export const selectPatientSchema = createSelectSchema(patient);
export const selectPatientMedicalFileSchema =
	createSelectSchema(patientMedicalFile);
export const selectAppointmentSchema = createSelectSchema(appointment);
export const selectInvoiceItemSchema = createSelectSchema(invoiceItem);
export const selectInvoicePaymentSchema = createSelectSchema(invoicePayment);
export const selectInvoiceSchema = createSelectSchema(invoice);
export const selectInvoiceWithItemsSchema = selectInvoiceSchema.merge(
	z.object({
		items: z.array(selectInvoiceItemSchema),
		payments: z.array(selectInvoicePaymentSchema),
	}),
);
export const selectInvoiceWithPatientSchema =
	selectInvoiceWithItemsSchema.merge(
		z.object({
			patient: selectPatientSchema
				.pick({
					id: true,
					firstName: true,
					lastName: true,
					cin: true,
					phoneNumber: true,
				})
				.nullable(),
		}),
	);
export const selectDoctorApplicationSchema =
	createSelectSchema(doctorApplication);
export const selectUserSchema = createSelectSchema(user);
export const selectReviewSchema = createSelectSchema(review);
export const selectDoctorApplicationWithRelationsSchema =
	selectDoctorApplicationSchema.merge(
		z.object({
			speciality: selectSpecialitySchema.nullable(),
			cabinetCity: selectCitiesSchema.nullable(),
			user: selectUserSchema
				.pick({ id: true, username: true, email: true })
				.nullable(),
		}),
	);
export const selectCallSchema = createSelectSchema(call);
export const selectCallEventSchema = createSelectSchema(callEvent);
export const selectCallWithEventsSchema = selectCallSchema.merge(
	z.object({
		events: z.array(selectCallEventSchema),
	}),
);

export const selectDoctorProfileWithRelationsSchema =
	selectDoctorProfileSchema.merge(
		z.object({
			speciality: selectSpecialitySchema.nullable(),
			cabinetCity: selectCitiesSchema.nullable(),
		}),
	);

export const selectUserWithDoctorProfileSchema = selectUserSchema.merge(
	z.object({
		hasDoctorProfile: z.boolean(),
		doctorProfile: selectDoctorProfileWithRelationsSchema.nullable(),
	}),
);

export const selectBestFitDoctorSchema = selectDoctorProfileSchema
	.omit({ availability: true })
	.merge(
		z.object({
			distance: z.number(),
			nextSlot: z.object({ start: z.string(), end: z.string() }),
		}),
	);

export const statsResponseSchema = z.object({
	total: z.number(),
	admins: z.number(),
	verified: z.number(),
	pending: z.number(),
	rejected: z.number(),
	banned: z.number(),
});

export const doctorDashboardStatsResponseSchema = z.object({
	counts: z.object({
		patients: z.number(),
		appointmentsToday: z.number(),
		appointmentsThisWeek: z.number(),
		upcomingAppointments: z.number(),
		pendingAppointments: z.number(),
		unpaidInvoices: z.number(),
	}),
	revenue: z.object({
		collectedThisMonth: z.number(),
		outstanding: z.number(),
	}),
	plan: z.object({
		planId: z.enum(["free", "pro"]),
		isPro: z.boolean(),
		limits: z.object({
			aiBookingPatients: z.number().nullable(),
			whatsappSendsPerMonth: z.number().nullable(),
		}),
		usage: z.object({
			aiBookingPatients: z.number(),
			whatsappSendsThisMonth: z.number(),
		}),
		usagePeriod: z.object({
			start: z.string(),
			end: z.string(),
			yyyyMm: z.string(),
		}),
	}),
	charts: z.object({
		appointmentsByDay: z.array(
			z.object({
				date: z.string(),
				total: z.number(),
				ai: z.number(),
				dashboard: z.number(),
			}),
		),
		appointmentsByStatus: z.array(
			z.object({
				status: z.string(),
				count: z.number(),
			}),
		),
		appointmentsBySource: z.array(
			z.object({
				source: z.string(),
				count: z.number(),
			}),
		),
	}),
	upcoming: z.array(
		z.object({
			id: z.number(),
			start: z.string().nullable(),
			end: z.string().nullable(),
			status: z.string().nullable(),
			source: z.string(),
			name: z.string().nullable(),
			patientName: z.string(),
		}),
	),
});

export const selectConsultationRecordingSchema = createSelectSchema(
	consultationRecording,
);

export const selectConsultationRecordingWithPatientSchema =
	selectConsultationRecordingSchema.merge(
		z.object({
			patient: selectPatientSchema
				.pick({ id: true, firstName: true, lastName: true })
				.nullable(),
		}),
	);

export const selectAiChatMessageSchema = createSelectSchema(aiChatMessage);
export const selectAiChatConversationSchema =
	createSelectSchema(aiChatConversation);

export const selectAiChatConversationListItemSchema =
	selectAiChatConversationSchema.merge(
		z.object({
			messageCount: z.number(),
			preview: z.string().nullable(),
		}),
	);

export const selectAiChatConversationWithMessagesSchema =
	selectAiChatConversationSchema.merge(
		z.object({
			messages: z.array(selectAiChatMessageSchema),
			recording: selectConsultationRecordingSchema
				.pick({ id: true, title: true, transcript: true })
				.nullable(),
		}),
	);

export const signedUrlResponseSchema = z.object({
	signedUrl: z.string(),
	key: z.string(),
	cdnUrl: z.string(),
});
