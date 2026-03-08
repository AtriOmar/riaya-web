import { relations } from "drizzle-orm";
import { doublePrecision, index, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { user, session, account } from "./auth-schema";

// Re-export better-auth tables so drizzle-kit picks them up from this single entry point
export * from "./auth-schema";

// ─── Speciality ───────────────────────────────────────────────────────────────

export const specialityTable = pgTable(
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

export const doctorProfileTable = pgTable(
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
    specialityId: integer("speciality_id").references(() => specialityTable.id),
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

export const patientTable = pgTable(
  "patient",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    doctorId: integer("doctor_id").references(() => doctorProfileTable.id),
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
  (table) => [index("patient_doctor_profile_id_idx").on(table.doctorId), index("patient_cin_idx").on(table.cin)],
);

// ─── Patient Medical File ─────────────────────────────────────────────────────

export const patientMedicalFileTable = pgTable(
  "patient_medical_file",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    patientId: integer("patient_id").references(() => patientTable.id),
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

export const appointmentTable = pgTable(
  "appointment",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    doctorId: integer("doctor_id").references(() => doctorProfileTable.id),
    patientId: integer("patient_id").references(() => patientTable.id),
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

export const consultationTable = pgTable(
  "consultation",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    patientId: integer("patient_id").references(() => patientTable.id),
    doctorId: integer("doctor_id").references(() => doctorProfileTable.id),
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

export const doctorApplicationTable = pgTable(
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
    specialityId: integer("speciality_id").references(() => specialityTable.id),
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

export const doctorUnavailabilityTable = pgTable(
  "doctor_unavailability",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    doctorId: integer("doctor_id").references(() => doctorProfileTable.id),
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
  doctorProfile: one(doctorProfileTable, {
    fields: [user.id],
    references: [doctorProfileTable.userId],
  }),
  doctorApplications: many(doctorApplicationTable),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const specialityRelations = relations(specialityTable, ({ many }) => ({
  doctorProfiles: many(doctorProfileTable),
  doctorApplications: many(doctorApplicationTable),
}));

export const doctorProfileRelations = relations(doctorProfileTable, ({ one, many }) => ({
  user: one(user, { fields: [doctorProfileTable.userId], references: [user.id] }),
  speciality: one(specialityTable, { fields: [doctorProfileTable.specialityId], references: [specialityTable.id] }),
  patients: many(patientTable),
  appointments: many(appointmentTable),
  consultations: many(consultationTable),
  unavailabilities: many(doctorUnavailabilityTable),
}));

export const patientRelations = relations(patientTable, ({ one, many }) => ({
  doctor: one(doctorProfileTable, { fields: [patientTable.doctorId], references: [doctorProfileTable.id] }),
  medicalFiles: many(patientMedicalFileTable),
  appointments: many(appointmentTable),
  consultations: many(consultationTable),
}));

export const patientMedicalFileRelations = relations(patientMedicalFileTable, ({ one }) => ({
  patient: one(patientTable, { fields: [patientMedicalFileTable.patientId], references: [patientTable.id] }),
}));

export const appointmentRelations = relations(appointmentTable, ({ one }) => ({
  doctor: one(doctorProfileTable, { fields: [appointmentTable.doctorId], references: [doctorProfileTable.id] }),
  patient: one(patientTable, { fields: [appointmentTable.patientId], references: [patientTable.id] }),
}));

export const consultationRelations = relations(consultationTable, ({ one }) => ({
  doctor: one(doctorProfileTable, { fields: [consultationTable.doctorId], references: [doctorProfileTable.id] }),
  patient: one(patientTable, { fields: [consultationTable.patientId], references: [patientTable.id] }),
}));

export const doctorApplicationRelations = relations(doctorApplicationTable, ({ one }) => ({
  user: one(user, { fields: [doctorApplicationTable.userId], references: [user.id] }),
  speciality: one(specialityTable, { fields: [doctorApplicationTable.specialityId], references: [specialityTable.id] }),
}));

export const doctorUnavailabilityRelations = relations(doctorUnavailabilityTable, ({ one }) => ({
  doctor: one(doctorProfileTable, {
    fields: [doctorUnavailabilityTable.doctorId],
    references: [doctorProfileTable.id],
  }),
}));
