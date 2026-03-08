import { doublePrecision, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

// ─── Specialities ────────────────────────────────────────────────────────────

export const specialitiesTable = pgTable("specialities", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }),
});

// ─── Users ───────────────────────────────────────────────────────────────────

export const usersTable = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  display: varchar("display", { length: 255 }),
  username: varchar("username", { length: 255 }),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  password: varchar("password", { length: 255 }),
  picture: varchar("picture", { length: 255 }),
  accessId: integer("access_id"), // 1: Doctor, 3: Admin
  active: integer("active"), // 0: suspended, 1: inactive, 2: active
  type: integer("type"),
  tin: varchar("tin", { length: 100 }), // Tax Identification Number
  status: varchar("status", { length: 50 }).default("none"), // none | pending | verified | rejected | banned
  cabinetName: varchar("cabinet_name", { length: 255 }),
  cabinetCity: varchar("cabinet_city", { length: 255 }),
  cabinetLongitude: doublePrecision("cabinet_longitude"),
  cabinetLatitude: doublePrecision("cabinet_latitude"),
  specialityId: integer("speciality_id").references(() => specialitiesTable.id),
  // Stored as JSONB: { [day 0-6]: [{ start: number, end: number }] }
  availability: jsonb("availability"),
  cinRecto: varchar("cin_recto", { length: 255 }),
  cinVerso: varchar("cin_verso", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Patients ─────────────────────────────────────────────────────────────────

export const patientsTable = pgTable("patients", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  doctorId: integer("doctor_id").references(() => usersTable.id),
  cin: varchar("cin", { length: 100 }),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  dateOfBirth: timestamp("date_of_birth"),
  gender: varchar("gender", { length: 50 }),
  address: text("address"),
  phoneNumber: varchar("phone_number", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Patient Medical Files ────────────────────────────────────────────────────

export const patientMedicalFilesTable = pgTable("patient_medical_files", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  patientId: integer("patient_id").references(() => patientsTable.id),
  type: varchar("type", { length: 100 }),
  date: timestamp("date"),
  title: varchar("title", { length: 255 }),
  description: text("description"),
  documents: text("documents").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Appointments ─────────────────────────────────────────────────────────────

export const appointmentsTable = pgTable("appointments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  doctorId: integer("doctor_id").references(() => usersTable.id),
  patientId: integer("patient_id").references(() => patientsTable.id),
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
});

// ─── Consultations ────────────────────────────────────────────────────────────

export const consultationsTable = pgTable("consultations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  patientId: integer("patient_id").references(() => patientsTable.id),
  doctorId: integer("doctor_id").references(() => usersTable.id),
  date: timestamp("date"),
  title: varchar("title", { length: 255 }),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Doctor Applications ──────────────────────────────────────────────────────

export const doctorApplicationsTable = pgTable("doctor_applications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").references(() => usersTable.id),
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
  specialityId: integer("speciality_id").references(() => specialitiesTable.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Doctor Unavailabilities ──────────────────────────────────────────────────

export const doctorUnavailabilitiesTable = pgTable("doctor_unavailabilities", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  doctorId: integer("doctor_id").references(() => usersTable.id),
  start: timestamp("start"),
  end: timestamp("end"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Temp Accounts ────────────────────────────────────────────────────────────

export const tempAccountsTable = pgTable("temp_accounts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  email: varchar("email", { length: 255 }),
  password: varchar("password", { length: 255 }),
  token: varchar("token", { length: 255 }),
  otp: varchar("otp", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
