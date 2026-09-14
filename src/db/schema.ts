import { relations } from "drizzle-orm";
import {
	boolean,
	doublePrecision,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";
import { account, session, user } from "./auth-schema";

// Re-export better-auth tables so drizzle-kit picks them up from this single entry point
export * from "./auth-schema";

// ─── Speciality ───────────────────────────────────────────────────────────────

export const speciality = pgTable(
	"speciality",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		enName: varchar("en_name", { length: 255 }),
		frName: varchar("fr_name", { length: 255 }),
		arName: varchar("ar_name", { length: 255 }),
		slug: varchar("slug", { length: 255 }).unique(),
	},
	(table) => [index("speciality_slug_idx").on(table.slug)],
);

// ─── Cities ───────────────────────────────────────────────────────────────────

export const cities = pgTable(
	"cities",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		postalCode: integer("postal_code"),
		latitude: doublePrecision("latitude"),
		longitude: doublePrecision("longitude"),
		enName: varchar("en_name", { length: 255 }),
		frName: varchar("fr_name", { length: 255 }),
		arName: varchar("ar_name", { length: 255 }),
		slug: varchar("slug", { length: 255 }).unique(),
	},
	(table) => [
		index("cities_postal_code_idx").on(table.postalCode),
		index("cities_slug_idx").on(table.slug),
	],
);

// ─── Doctor Profile ───────────────────────────────────────────────────────────
// Only exists for users with a doctor account.
// General user fields (displayName, accessId, active, type) live in better-auth's `user` table.

export const doctorProfile = pgTable(
	"doctor_profile",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		userId: text("user_id")
			.notNull()
			.unique()
			.references(() => user.id, { onDelete: "cascade" }),
		firstName: varchar("first_name", { length: 255 }),
		lastName: varchar("last_name", { length: 255 }),
		cin: varchar("cin", { length: 100 }),
		tin: varchar("tin", { length: 100 }), // Tax Identification Number
		status: varchar("status", { length: 50 }).default("none"), // none | pending | verified | rejected | banned
		address: text("address"),
		cabinetName: varchar("cabinet_name", { length: 255 }),
		cabinetCityId: integer("cabinet_city_id").references(() => cities.id),
		cabinetLongitude: doublePrecision("cabinet_longitude"),
		cabinetLatitude: doublePrecision("cabinet_latitude"),
		specialityId: integer("speciality_id").references(() => speciality.id),
		// Stored as JSONB: { [day 0-6]: [{ start: number, end: number }] }
		availability: jsonb("availability"),
		cinRecto: varchar("cin_recto", { length: 255 }),
		cinVerso: varchar("cin_verso", { length: 255 }),
		medicalCouncilNumber: varchar("medical_council_number", { length: 100 }),
		medicalCouncilCertificate: varchar("medical_council_certificate", {
			length: 255,
		}),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(table) => [
		index("doctor_profile_user_id_idx").on(table.userId),
		index("doctor_profile_status_idx").on(table.status),
		index("doctor_profile_cabinet_city_id_idx").on(table.cabinetCityId),
		index("doctor_profile_speciality_id_idx").on(table.specialityId),
		index("doctor_profile_cin_idx").on(table.cin),
	],
);

// ─── Person ───────────────────────────────────────────────────────────────────
// Phone-number-based identity. Created automatically when someone calls.

export const person = pgTable(
	"person",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		phoneNumber: varchar("phone_number", { length: 50 }).notNull().unique(),
		// call = Twilio / external phone booking; doctor = dashboard patient create
		source: varchar("source", { length: 50 }).notNull().default("call"),
		firstName: varchar("first_name", { length: 255 }),
		lastName: varchar("last_name", { length: 255 }),
		dateOfBirth: timestamp("date_of_birth"),
		gender: varchar("gender", { length: 50 }),
		address: text("address"),
		/** Voice/UI language: en, fr, or ar (Tunisian Derja). Default Arabic. */
		preferredLanguage: varchar("preferred_language", { length: 8 })
			.notNull()
			.default("ar"),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(table) => [index("person_phone_number_idx").on(table.phoneNumber)],
);

// ─── Patient ──────────────────────────────────────────────────────────────────

export const patient = pgTable(
	"patient",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		personId: integer("person_id").references(() => person.id),
		doctorId: integer("doctor_id").references(() => doctorProfile.id),
		cin: varchar("cin", { length: 100 }),
		firstName: varchar("first_name", { length: 255 }),
		lastName: varchar("last_name", { length: 255 }),
		dateOfBirth: timestamp("date_of_birth"),
		gender: varchar("gender", { length: 50 }),
		address: text("address"),
		phoneNumber: varchar("phone_number", { length: 50 }),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(table) => [
		index("patient_doctor_profile_id_idx").on(table.doctorId),
		index("patient_cin_idx").on(table.cin),
	],
);

// ─── Patient Medical File ─────────────────────────────────────────────────────

export const patientMedicalFile = pgTable(
	"patient_medical_file",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		patientId: integer("patient_id").references(() => patient.id),
		type: varchar("type", { length: 100 }),
		date: timestamp("date"),
		title: varchar("title", { length: 255 }),
		description: text("description"),
		documents: text("documents").array(),
		sentViaWhatsapp: boolean("sent_via_whatsapp").default(false),
		createdAt: timestamp("created_at").defaultNow(),
	},
	(table) => [index("patient_medical_file_patient_id_idx").on(table.patientId)],
);

// ─── Appointment ──────────────────────────────────────────────────────────────

export const appointment = pgTable(
	"appointment",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		doctorId: integer("doctor_id").references(() => doctorProfile.id),
		patientId: integer("patient_id").references(() => patient.id),
		start: timestamp("start"),
		end: timestamp("end"),
		status: varchar("status", { length: 50 }), // pending | confirmed | cancelled
		// ai = phone AI booking; dashboard = doctor dashboard
		source: varchar("source", { length: 50 }).notNull().default("dashboard"),
		name: varchar("name", { length: 255 }),
		description: text("description"),
		// Flattened newPatient sub-document
		newPatientName: varchar("new_patient_name", { length: 255 }),
		newPatientPhoneNumber: varchar("new_patient_phone_number", { length: 50 }),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(table) => [
		index("appointment_doctor_id_idx").on(table.doctorId),
		index("appointment_patient_id_idx").on(table.patientId),
		index("appointment_status_idx").on(table.status),
		index("appointment_start_idx").on(table.start),
		index("appointment_source_idx").on(table.source),
	],
);

// ─── Review ───────────────────────────────────────────────────────────────────

export const review = pgTable(
	"review",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		appointmentId: integer("appointment_id").references(() => appointment.id),
		doctorId: integer("doctor_id").references(() => doctorProfile.id),
		patientId: integer("patient_id").references(() => patient.id),
		token: varchar("token", { length: 255 }).unique().notNull(),
		rating: integer("rating"),
		waitTime: varchar("wait_time", { length: 50 }),
		comment: text("comment"),
		status: varchar("status", { length: 50 }).default("pending"),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(table) => [
		index("review_appointment_id_idx").on(table.appointmentId),
		index("review_doctor_id_idx").on(table.doctorId),
		index("review_patient_id_idx").on(table.patientId),
		index("review_token_idx").on(table.token),
	],
);

// ─── Consultation ─────────────────────────────────────────────────────────────

export const consultation = pgTable(
	"consultation",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		patientId: integer("patient_id").references(() => patient.id),
		doctorId: integer("doctor_id").references(() => doctorProfile.id),
		date: timestamp("date"),
		title: varchar("title", { length: 255 }),
		description: text("description"),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(table) => [
		index("consultation_patient_id_idx").on(table.patientId),
		index("consultation_doctor_id_idx").on(table.doctorId),
	],
);

// ─── Invoice ──────────────────────────────────────────────────────────────────
// Amounts are stored in millimes (1 TND = 1000). Column names use *Centimes
// historically. Status is derived from amountPaid vs total except for explicit
// "cancelled".

export const invoice = pgTable(
	"invoice",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		doctorId: integer("doctor_id")
			.notNull()
			.references(() => doctorProfile.id),
		patientId: integer("patient_id")
			.notNull()
			.references(() => patient.id),
		appointmentId: integer("appointment_id").references(() => appointment.id),
		number: varchar("number", { length: 50 }).notNull(),
		// unpaid | partially_paid | paid | cancelled
		status: varchar("status", { length: 50 }).notNull().default("unpaid"),
		currency: varchar("currency", { length: 10 }).notNull().default("TND"),
		totalCentimes: integer("total_centimes").notNull().default(0),
		amountPaidCentimes: integer("amount_paid_centimes").notNull().default(0),
		// cash | transfer (set when any amount has been paid)
		paymentMethod: varchar("payment_method", { length: 50 }),
		notes: text("notes"),
		pdfUrl: varchar("pdf_url", { length: 1024 }),
		sentViaWhatsapp: boolean("sent_via_whatsapp").default(false),
		issuedAt: timestamp("issued_at").defaultNow(),
		paidAt: timestamp("paid_at"),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(table) => [
		index("invoice_doctor_id_idx").on(table.doctorId),
		index("invoice_patient_id_idx").on(table.patientId),
		index("invoice_status_idx").on(table.status),
		index("invoice_number_idx").on(table.number),
		index("invoice_issued_at_idx").on(table.issuedAt),
	],
);

export const invoiceItem = pgTable(
	"invoice_item",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		invoiceId: integer("invoice_id")
			.notNull()
			.references(() => invoice.id, { onDelete: "cascade" }),
		description: varchar("description", { length: 255 }).notNull(),
		quantity: integer("quantity").notNull().default(1),
		unitPriceCentimes: integer("unit_price_centimes").notNull(),
		createdAt: timestamp("created_at").defaultNow(),
	},
	(table) => [index("invoice_item_invoice_id_idx").on(table.invoiceId)],
);

export const invoicePayment = pgTable(
	"invoice_payment",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		invoiceId: integer("invoice_id")
			.notNull()
			.references(() => invoice.id, { onDelete: "cascade" }),
		amountCentimes: integer("amount_centimes").notNull(),
		// cash | transfer
		paymentMethod: varchar("payment_method", { length: 50 }).notNull(),
		paidAt: timestamp("paid_at").defaultNow().notNull(),
		notes: text("notes"),
		createdAt: timestamp("created_at").defaultNow(),
	},
	(table) => [
		index("invoice_payment_invoice_id_idx").on(table.invoiceId),
		index("invoice_payment_paid_at_idx").on(table.paidAt),
	],
);

// ─── Doctor Application ───────────────────────────────────────────────────────
// userId references better-auth's user — the applicant doesn't have a doctor profile yet.

export const doctorApplication = pgTable(
	"doctor_application",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
		firstName: varchar("first_name", { length: 255 }),
		lastName: varchar("last_name", { length: 255 }),
		cinRecto: varchar("cin_recto", { length: 255 }),
		cinVerso: varchar("cin_verso", { length: 255 }),
		cabinetName: varchar("cabinet_name", { length: 255 }),
		cabinetCityId: integer("cabinet_city_id").references(() => cities.id),
		cabinetLongitude: doublePrecision("cabinet_longitude"),
		cabinetLatitude: doublePrecision("cabinet_latitude"),
		status: varchar("status", { length: 50 }).default("pending"),
		tin: varchar("tin", { length: 100 }),
		rejectionReasons: text("rejection_reasons").array(),
		specialityId: integer("speciality_id").references(() => speciality.id),
		medicalCouncilNumber: varchar("medical_council_number", { length: 100 }),
		medicalCouncilCertificate: varchar("medical_council_certificate", {
			length: 255,
		}),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(table) => [
		index("doctor_application_user_id_idx").on(table.userId),
		index("doctor_application_status_idx").on(table.status),
		index("doctor_application_cabinet_city_id_idx").on(table.cabinetCityId),
		index("doctor_application_speciality_id_idx").on(table.specialityId),
	],
);

// ─── Call ─────────────────────────────────────────────────────────────────────
// One row per Twilio phone call handled by the AI assistant.

export const call = pgTable(
	"call",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		callSid: varchar("call_sid", { length: 100 }).notNull().unique(),
		from: varchar("from", { length: 50 }),
		to: varchar("to", { length: 50 }),
		direction: varchar("direction", { length: 50 }),
		status: varchar("status", { length: 50 }).default("in-progress"), // in-progress | completed | failed
		callerName: varchar("caller_name", { length: 255 }),
		startedAt: timestamp("started_at").defaultNow(),
		endedAt: timestamp("ended_at"),
		duration: integer("duration"), // seconds
		appointmentId: integer("appointment_id").references(() => appointment.id, {
			onDelete: "set null",
		}),
		recordingSid: varchar("recording_sid", { length: 100 }),
		recordingKey: varchar("recording_key", { length: 512 }),
		recordingUrl: varchar("recording_url", { length: 1024 }),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(table) => [
		index("call_call_sid_idx").on(table.callSid),
		index("call_status_idx").on(table.status),
		index("call_started_at_idx").on(table.startedAt),
		index("call_appointment_id_idx").on(table.appointmentId),
	],
);

// ─── Call Event ───────────────────────────────────────────────────────────────
// Every loggable moment inside a call (transcripts, function calls, system notes, errors).

export const callEvent = pgTable(
	"call_event",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		callId: integer("call_id")
			.notNull()
			.references(() => call.id, { onDelete: "cascade" }),
		type: varchar("type", { length: 50 }).notNull(), // patient_transcript | ai_transcript | function_call | system | error | appointment_booked
		content: text("content"),
		functionName: varchar("function_name", { length: 100 }),
		functionArgs: jsonb("function_args"),
		functionResult: jsonb("function_result"),
		functionStatus: varchar("function_status", { length: 50 }), // calling | success | error
		timestamp: timestamp("timestamp").defaultNow(),
	},
	(table) => [
		index("call_event_call_id_idx").on(table.callId),
		index("call_event_type_idx").on(table.type),
		index("call_event_timestamp_idx").on(table.timestamp),
	],
);

// ─── Doctor Unavailability ────────────────────────────────────────────────────

export const doctorUnavailability = pgTable(
	"doctor_unavailability",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		doctorId: integer("doctor_id").references(() => doctorProfile.id),
		start: timestamp("start"),
		end: timestamp("end"),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(table) => [
		index("doctor_unavailability_doctor_id_idx").on(table.doctorId),
		index("doctor_unavailability_start_idx").on(table.start),
	],
);

// temp_accounts removed — better-auth's emailVerification plugin handles this via
// the `verification` table in auth-schema.ts. Configure `requireEmailVerification: true`
// in your auth instance to block login until the email is verified.

// ─── Subscription ─────────────────────────────────────────────────────────────
// One row per doctor. Created with plan = "free" on first access.
// Managed manually (Konnect has no native subscriptions). Status drives feature gating.

export const subscription = pgTable(
	"subscription",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		doctorId: integer("doctor_id")
			.notNull()
			.unique()
			.references(() => doctorProfile.id, { onDelete: "cascade" }),
		planId: varchar("plan_id", { length: 50 }).notNull().default("free"),
		// active | canceled | past_due
		status: varchar("status", { length: 50 }).notNull().default("active"),
		currentPeriodStart: timestamp("current_period_start"),
		currentPeriodEnd: timestamp("current_period_end"),
		cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(table) => [
		index("subscription_doctor_id_idx").on(table.doctorId),
		index("subscription_plan_id_idx").on(table.planId),
		index("subscription_status_idx").on(table.status),
		index("subscription_period_end_idx").on(table.currentPeriodEnd),
	],
);

// ─── Billing Invoice ──────────────────────────────────────────────────────────
// One row per billing cycle invoice issued to a doctor (distinct from patient `invoice`).
// Payment is handled via Konnect.network.

export const billingInvoice = pgTable(
	"billing_invoice",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		doctorId: integer("doctor_id")
			.notNull()
			.references(() => doctorProfile.id, { onDelete: "cascade" }),
		subscriptionId: integer("subscription_id").references(
			() => subscription.id,
			{ onDelete: "set null" },
		),
		// Sequential invoice number e.g. "INV-2026-001"
		number: varchar("number", { length: 100 }).notNull().unique(),
		// open | paid | cancelled
		status: varchar("status", { length: 50 }).notNull().default("open"),
		// Amount in millimes (1 TND = 1000 millimes)
		amountMillimes: integer("amount_millimes").notNull(),
		// Konnect payment reference returned by initiate-payment
		konnectPaymentRef: varchar("konnect_payment_ref", { length: 255 }).unique(),
		// Direct payment URL for the doctor
		konnectPayUrl: varchar("konnect_pay_url", { length: 1024 }),
		periodStart: timestamp("period_start"),
		periodEnd: timestamp("period_end"),
		dueDate: timestamp("due_date"),
		paidAt: timestamp("paid_at"),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(table) => [
		index("billing_invoice_doctor_id_idx").on(table.doctorId),
		index("billing_invoice_status_idx").on(table.status),
		index("billing_invoice_konnect_ref_idx").on(table.konnectPaymentRef),
	],
);

// ─── Consultation Recording ───────────────────────────────────────────────────
// Recordings made by the doctor during or after a patient consultation.
// Linked optionally to a patient. Transcript is generated via Azure AI.

export const consultationRecording = pgTable(
	"consultation_recording",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		doctorId: integer("doctor_id")
			.notNull()
			.references(() => doctorProfile.id, { onDelete: "cascade" }),
		patientId: integer("patient_id").references(() => patient.id, {
			onDelete: "set null",
		}),
		title: varchar("title", { length: 255 }),
		audioUrl: varchar("audio_url", { length: 1024 }).notNull(),
		durationSeconds: integer("duration_seconds"),
		transcript: text("transcript"),
		// pending | processing | done | error
		transcriptStatus: varchar("transcript_status", { length: 50 })
			.notNull()
			.default("pending"),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(table) => [
		index("consultation_recording_doctor_id_idx").on(table.doctorId),
		index("consultation_recording_patient_id_idx").on(table.patientId),
		index("consultation_recording_created_at_idx").on(table.createdAt),
	],
);

// ─── AI Chat Conversation ─────────────────────────────────────────────────────
// Persisted doctor ↔ AI assistant conversations (optionally linked to a recording).

export const aiChatConversation = pgTable(
	"ai_chat_conversation",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		doctorId: integer("doctor_id")
			.notNull()
			.references(() => doctorProfile.id, { onDelete: "cascade" }),
		title: varchar("title", { length: 255 }),
		recordingId: integer("recording_id").references(
			() => consultationRecording.id,
			{ onDelete: "set null" },
		),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(table) => [
		index("ai_chat_conversation_doctor_id_idx").on(table.doctorId),
		index("ai_chat_conversation_recording_id_idx").on(table.recordingId),
		index("ai_chat_conversation_updated_at_idx").on(table.updatedAt),
	],
);

export const aiChatMessage = pgTable(
	"ai_chat_message",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		conversationId: integer("conversation_id")
			.notNull()
			.references(() => aiChatConversation.id, { onDelete: "cascade" }),
		// user | assistant
		role: varchar("role", { length: 20 }).notNull(),
		content: text("content").notNull(),
		createdAt: timestamp("created_at").defaultNow(),
	},
	(table) => [
		index("ai_chat_message_conversation_id_idx").on(table.conversationId),
		index("ai_chat_message_created_at_idx").on(table.createdAt),
	],
);

// ─── WhatsApp usage (monthly counter) ─────────────────────────────────────────

export const whatsappUsage = pgTable(
	"whatsapp_usage",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		doctorId: integer("doctor_id")
			.notNull()
			.references(() => doctorProfile.id, { onDelete: "cascade" }),
		/** Calendar month key, e.g. "2026-09" (UTC) */
		periodYyyyMm: varchar("period_yyyy_mm", { length: 7 }).notNull(),
		sendCount: integer("send_count").notNull().default(0),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(table) => [
		uniqueIndex("whatsapp_usage_doctor_period_uidx").on(
			table.doctorId,
			table.periodYyyyMm,
		),
		index("whatsapp_usage_doctor_id_idx").on(table.doctorId),
	],
);

// ─── Relations ────────────────────────────────────────────────────────────────
// Centralised here so every table is in scope (avoids circular imports with auth-schema.ts).

export const userRelations = relations(user, ({ many, one }) => ({
	sessions: many(session),
	accounts: many(account),
	doctorProfile: one(doctorProfile, {
		fields: [user.id],
		references: [doctorProfile.userId],
	}),
	doctorApplications: many(doctorApplication),
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const specialityRelations = relations(speciality, ({ many }) => ({
	doctorProfiles: many(doctorProfile),
	doctorApplications: many(doctorApplication),
}));

export const citiesRelations = relations(cities, ({ many }) => ({
	doctorProfiles: many(doctorProfile),
	doctorApplications: many(doctorApplication),
}));

export const doctorProfileRelations = relations(
	doctorProfile,
	({ one, many }) => ({
		user: one(user, {
			fields: [doctorProfile.userId],
			references: [user.id],
		}),
		speciality: one(speciality, {
			fields: [doctorProfile.specialityId],
			references: [speciality.id],
		}),
		cabinetCity: one(cities, {
			fields: [doctorProfile.cabinetCityId],
			references: [cities.id],
		}),
		patients: many(patient),
		appointments: many(appointment),
		consultations: many(consultation),
		invoices: many(invoice),
		unavailabilities: many(doctorUnavailability),
		reviews: many(review),
		subscription: one(subscription, {
			fields: [doctorProfile.id],
			references: [subscription.doctorId],
		}),
		billingInvoices: many(billingInvoice),
		whatsappUsage: many(whatsappUsage),
		consultationRecordings: many(consultationRecording),
		aiChatConversations: many(aiChatConversation),
	}),
);

export const subscriptionRelations = relations(
	subscription,
	({ one, many }) => ({
		doctor: one(doctorProfile, {
			fields: [subscription.doctorId],
			references: [doctorProfile.id],
		}),
		billingInvoices: many(billingInvoice),
	}),
);

export const billingInvoiceRelations = relations(billingInvoice, ({ one }) => ({
	doctor: one(doctorProfile, {
		fields: [billingInvoice.doctorId],
		references: [doctorProfile.id],
	}),
	subscription: one(subscription, {
		fields: [billingInvoice.subscriptionId],
		references: [subscription.id],
	}),
}));

export const whatsappUsageRelations = relations(whatsappUsage, ({ one }) => ({
	doctor: one(doctorProfile, {
		fields: [whatsappUsage.doctorId],
		references: [doctorProfile.id],
	}),
}));

export const personRelations = relations(person, ({ many }) => ({
	patients: many(patient),
}));

export const patientRelations = relations(patient, ({ one, many }) => ({
	person: one(person, {
		fields: [patient.personId],
		references: [person.id],
	}),
	doctor: one(doctorProfile, {
		fields: [patient.doctorId],
		references: [doctorProfile.id],
	}),
	medicalFiles: many(patientMedicalFile),
	appointments: many(appointment),
	consultations: many(consultation),
	invoices: many(invoice),
	reviews: many(review),
	consultationRecordings: many(consultationRecording),
}));

export const patientMedicalFileRelations = relations(
	patientMedicalFile,
	({ one }) => ({
		patient: one(patient, {
			fields: [patientMedicalFile.patientId],
			references: [patient.id],
		}),
	}),
);

export const appointmentRelations = relations(appointment, ({ one, many }) => ({
	doctor: one(doctorProfile, {
		fields: [appointment.doctorId],
		references: [doctorProfile.id],
	}),
	patient: one(patient, {
		fields: [appointment.patientId],
		references: [patient.id],
	}),
	calls: many(call),
	reviews: many(review),
}));

export const callRelations = relations(call, ({ one, many }) => ({
	appointment: one(appointment, {
		fields: [call.appointmentId],
		references: [appointment.id],
	}),
	events: many(callEvent),
}));

export const callEventRelations = relations(callEvent, ({ one }) => ({
	call: one(call, {
		fields: [callEvent.callId],
		references: [call.id],
	}),
}));

export const consultationRelations = relations(consultation, ({ one }) => ({
	doctor: one(doctorProfile, {
		fields: [consultation.doctorId],
		references: [doctorProfile.id],
	}),
	patient: one(patient, {
		fields: [consultation.patientId],
		references: [patient.id],
	}),
}));

export const invoiceRelations = relations(invoice, ({ one, many }) => ({
	doctor: one(doctorProfile, {
		fields: [invoice.doctorId],
		references: [doctorProfile.id],
	}),
	patient: one(patient, {
		fields: [invoice.patientId],
		references: [patient.id],
	}),
	appointment: one(appointment, {
		fields: [invoice.appointmentId],
		references: [appointment.id],
	}),
	items: many(invoiceItem),
	payments: many(invoicePayment),
}));

export const invoiceItemRelations = relations(invoiceItem, ({ one }) => ({
	invoice: one(invoice, {
		fields: [invoiceItem.invoiceId],
		references: [invoice.id],
	}),
}));

export const invoicePaymentRelations = relations(invoicePayment, ({ one }) => ({
	invoice: one(invoice, {
		fields: [invoicePayment.invoiceId],
		references: [invoice.id],
	}),
}));

export const doctorApplicationRelations = relations(
	doctorApplication,
	({ one }) => ({
		user: one(user, {
			fields: [doctorApplication.userId],
			references: [user.id],
		}),
		speciality: one(speciality, {
			fields: [doctorApplication.specialityId],
			references: [speciality.id],
		}),
		cabinetCity: one(cities, {
			fields: [doctorApplication.cabinetCityId],
			references: [cities.id],
		}),
	}),
);

export const doctorUnavailabilityRelations = relations(
	doctorUnavailability,
	({ one }) => ({
		doctor: one(doctorProfile, {
			fields: [doctorUnavailability.doctorId],
			references: [doctorProfile.id],
		}),
	}),
);

export const consultationRecordingRelations = relations(
	consultationRecording,
	({ one, many }) => ({
		doctor: one(doctorProfile, {
			fields: [consultationRecording.doctorId],
			references: [doctorProfile.id],
		}),
		patient: one(patient, {
			fields: [consultationRecording.patientId],
			references: [patient.id],
		}),
		aiChatConversations: many(aiChatConversation),
	}),
);

export const aiChatConversationRelations = relations(
	aiChatConversation,
	({ one, many }) => ({
		doctor: one(doctorProfile, {
			fields: [aiChatConversation.doctorId],
			references: [doctorProfile.id],
		}),
		recording: one(consultationRecording, {
			fields: [aiChatConversation.recordingId],
			references: [consultationRecording.id],
		}),
		messages: many(aiChatMessage),
	}),
);

export const aiChatMessageRelations = relations(aiChatMessage, ({ one }) => ({
	conversation: one(aiChatConversation, {
		fields: [aiChatMessage.conversationId],
		references: [aiChatConversation.id],
	}),
}));

export const reviewRelations = relations(review, ({ one }) => ({
	appointment: one(appointment, {
		fields: [review.appointmentId],
		references: [appointment.id],
	}),
	doctor: one(doctorProfile, {
		fields: [review.doctorId],
		references: [doctorProfile.id],
	}),
	patient: one(patient, {
		fields: [review.patientId],
		references: [patient.id],
	}),
}));
