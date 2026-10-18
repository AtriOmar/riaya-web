import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { aiChatPartSchema } from "@/lib/ai-chat-parts";
import { consultationSummarySchema } from "@/lib/consultation-summary";
import { PLAN_IDS } from "@/lib/plans";
import { speakerRolesSchema } from "@/lib/speaker-roles";
import {
	aiChatConversation,
	aiChatMessage,
	aiChatMessageStatuses,
	appointment,
	billingInvoice,
	blockedPhone,
	call,
	callEvent,
	callReport,
	callReportCategories,
	callReportStatuses,
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
	subscription,
	user,
} from "./schema";

export const selectSpecialitySchema = createSelectSchema(speciality);
export const selectCitiesSchema = createSelectSchema(cities);
/** Weekly opening hours: day "0"-"6" (Mon-Sun) → slots in minutes from midnight. */
export const availabilitySchema = z.record(
	z.string(),
	z.array(z.object({ start: z.number(), end: z.number() })),
);

export const selectDoctorProfileSchema = createSelectSchema(doctorProfile, {
	availability: availabilitySchema.nullable(),
});
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
export const selectCallReportSchema = createSelectSchema(callReport, {
	category: z.enum(callReportCategories),
	status: z.enum(callReportStatuses),
});
export const selectBlockedPhoneSchema = createSelectSchema(blockedPhone);
export const selectCallWithEventsSchema = selectCallSchema.merge(
	z.object({
		events: z.array(selectCallEventSchema),
		report: selectCallReportSchema
			.pick({ id: true, category: true, status: true })
			.nullable(),
	}),
);

/** What admins see about a reported number across all its calls. */
export const callReportNumberSchema = z.object({
	reportCount: z.number().int(),
	callCount: z.number().int(),
	blocked: z.boolean(),
});

export const selectCallReportListItemSchema = selectCallReportSchema.merge(
	z.object({
		call: selectCallSchema.pick({
			id: true,
			startedAt: true,
			duration: true,
			recordingUrl: true,
		}),
		number: callReportNumberSchema,
	}),
);

export const selectCallReportDetailSchema = selectCallReportSchema.merge(
	z.object({
		call: selectCallWithEventsSchema.omit({ report: true }),
		number: callReportNumberSchema,
		otherReports: z.array(selectCallReportSchema),
		block: selectBlockedPhoneSchema.nullable(),
	}),
);

export const selectBlockedPhoneListItemSchema = selectBlockedPhoneSchema.merge(
	z.object({ blockedByName: z.string().nullable() }),
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
			/** Present (true) when beyond the radius and returned as a fallback. */
			outsideRadius: z.boolean().optional(),
			/** Road distance (km) and drive time (min); set when routing succeeded. */
			roadDistanceKm: z.number().optional(),
			driveMinutes: z.number().optional(),
			nextSlot: z.object({ start: z.string(), end: z.string() }),
			/** Additional forward slots around desiredTime for AI alternatives. */
			nearbySlots: z
				.array(z.object({ start: z.string(), end: z.string() }))
				.optional(),
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

/** A doctor's effective plan, its limits and this month's usage. */
export const planUsageSchema = z.object({
	planId: z.enum(PLAN_IDS),
	isPro: z.boolean(),
	limits: z.object({
		whatsappSendsPerMonth: z.number().nullable(),
		recordingHoursPerMonth: z.number(),
	}),
	canBuyRecordingPacks: z.boolean(),
	canBrandDocuments: z.boolean(),
	canSummarizeRecordings: z.boolean(),
	usage: z.object({
		whatsappSendsThisMonth: z.number(),
		/** Share of the month's AI assistant budget used, 0–100 */
		aiPercentUsed: z.number(),
	}),
	recordingTime: z.object({
		includedSeconds: z.number(),
		usedSeconds: z.number(),
		extraSeconds: z.number(),
		remainingSeconds: z.number(),
	}),
	usagePeriod: z.object({
		start: z.string(),
		end: z.string(),
		yyyyMm: z.string(),
	}),
});

export const selectSubscriptionSchema = createSelectSchema(subscription);
export const selectBillingInvoiceSchema = createSelectSchema(billingInvoice);

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
	plan: planUsageSchema,
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
	{
		summary: consultationSummarySchema.nullable(),
		speakerRoles: speakerRolesSchema.nullable(),
	},
);

export const selectConsultationRecordingWithPatientSchema =
	selectConsultationRecordingSchema.merge(
		z.object({
			patient: selectPatientSchema
				.pick({ id: true, firstName: true, lastName: true })
				.nullable(),
		}),
	);

export const selectAiChatMessageSchema = createSelectSchema(aiChatMessage, {
	status: z.enum(aiChatMessageStatuses),
	parts: z.array(aiChatPartSchema),
});
export const selectAiChatConversationSchema =
	createSelectSchema(aiChatConversation);

export const selectAiChatConversationListItemSchema =
	selectAiChatConversationSchema.merge(
		z.object({
			messageCount: z.number(),
		}),
	);

export const selectAiChatConversationWithMessagesSchema =
	selectAiChatConversationSchema.merge(
		z.object({
			messages: z.array(selectAiChatMessageSchema),
			recording: selectConsultationRecordingSchema
				.pick({ id: true, title: true, transcript: true, speakerRoles: true })
				.nullable(),
		}),
	);

export const signedUrlResponseSchema = z.object({
	signedUrl: z.string(),
	key: z.string(),
	cdnUrl: z.string(),
});
