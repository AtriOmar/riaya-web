import { relations } from "drizzle-orm";
import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { user, session, account } from "./auth-schema";

// Re-export better-auth tables so drizzle-kit picks them up from this single entry point
export * from "./auth-schema";

// ─── Speciality ───────────────────────────────────────────────────────────────

export const speciality = pgTable(
  "speciality",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: varchar("name", { length: 255 }),
  },
  (table) => [index("speciality_name_idx").on(table.name)],
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
    tin: varchar("tin", { length: 100 }), // Tax Identification Number
    status: varchar("status", { length: 50 }).default("none"), // none | pending | verified | rejected | banned
    cabinetName: varchar("cabinet_name", { length: 255 }),
    cabinetCity: varchar("cabinet_city", { length: 255 }),
    cabinetLongitude: doublePrecision("cabinet_longitude"),
    cabinetLatitude: doublePrecision("cabinet_latitude"),
    specialityId: integer("speciality_id").references(() => speciality.id),
    // Stored as JSONB: { [day 0-6]: [{ start: number, end: number }] }
    availability: jsonb("availability"),
    cinRecto: varchar("cin_recto", { length: 255 }),
    cinVerso: varchar("cin_verso", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("doctor_profile_user_id_idx").on(table.userId),
    index("doctor_profile_status_idx").on(table.status),
    index("doctor_profile_speciality_id_idx").on(table.specialityId),
  ],
);

// ─── Patient ──────────────────────────────────────────────────────────────────

export const patient = pgTable(
  "patient",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
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
    cabinetCity: varchar("cabinet_city", { length: 255 }),
    cabinetLongitude: doublePrecision("cabinet_longitude"),
    cabinetLatitude: doublePrecision("cabinet_latitude"),
    status: varchar("status", { length: 50 }).default("pending"),
    tin: varchar("tin", { length: 100 }),
    rejectionReasons: text("rejection_reasons").array(),
    specialityId: integer("speciality_id").references(() => speciality.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("doctor_application_user_id_idx").on(table.userId),
    index("doctor_application_status_idx").on(table.status),
    index("doctor_application_speciality_id_idx").on(table.specialityId),
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
    patients: many(patient),
    appointments: many(appointment),
    consultations: many(consultation),
    unavailabilities: many(doctorUnavailability),
  }),
);

export const patientRelations = relations(patient, ({ one, many }) => ({
  doctor: one(doctorProfile, {
    fields: [patient.doctorId],
    references: [doctorProfile.id],
  }),
  medicalFiles: many(patientMedicalFile),
  appointments: many(appointment),
  consultations: many(consultation),
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

export const appointmentRelations = relations(appointment, ({ one }) => ({
  doctor: one(doctorProfile, {
    fields: [appointment.doctorId],
    references: [doctorProfile.id],
  }),
  patient: one(patient, {
    fields: [appointment.patientId],
    references: [patient.id],
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
