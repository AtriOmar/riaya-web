import type { InferSelectModel } from "drizzle-orm";
import type {
	appointment,
	call,
	callEvent,
	cities,
	doctorApplication,
	doctorProfile,
	patient,
	patientMedicalFile,
	speciality,
} from "@/db/schema";

// ─── Base models ──────────────────────────────────────────────────────────────

export type Appointment = InferSelectModel<typeof appointment>;
export type Patient = InferSelectModel<typeof patient>;
export type PatientMedicalFile = InferSelectModel<typeof patientMedicalFile>;
export type DoctorProfile = InferSelectModel<typeof doctorProfile>;
export type DoctorApplication = InferSelectModel<typeof doctorApplication>;
export type Speciality = InferSelectModel<typeof speciality>;
export type City = InferSelectModel<typeof cities>;
export type Call = InferSelectModel<typeof call>;
export type CallEvent = InferSelectModel<typeof callEvent>;

// ─── User ─────────────────────────────────────────────────────────────────────
// Matches the projection returned by the user routes

export type UserRow = {
	id: string;
	name: string;
	email: string;
	image: string | null;
	displayName: string | null;
	username: string | null;
	accessId: number | null;
	active: number | null;
	type: number | null;
	createdAt: Date;
};

export type UserAdminUpdateResult = {
	id: string;
	name: string;
	email: string;
	accessId: number | null;
	active: number | null;
};

// ─── Composite types ──────────────────────────────────────────────────────────

export type AppointmentWithPatient = Appointment & { patient: Patient | null };

export type PatientSummary = Pick<
	Patient,
	"id" | "firstName" | "lastName" | "cin" | "dateOfBirth"
>;

export type PatientWithMedicalFiles = Patient & {
	medicalFiles: PatientMedicalFile[];
};

type ApplicationUser = { id: string; username: string | null; email: string };
type ApplicationSpeciality = {
	id: number;
	enName: string | null;
	frName: string | null;
	arName: string | null;
	slug: string | null;
};
type ApplicationCity = {
	id: number;
	postalCode: number | null;
	enName: string | null;
	frName: string | null;
	arName: string | null;
	slug: string | null;
};

export type DoctorApplicationSummary = DoctorApplication & {
	user: ApplicationUser;
};
export type DoctorApplicationDetail = DoctorApplication & {
	user: ApplicationUser;
	speciality: ApplicationSpeciality | null;
	cabinetCity: ApplicationCity | null;
};

export type DoctorProfileWithSpeciality = DoctorProfile & {
	speciality: Speciality | null;
};

/** Profile as returned by GET /api/users/me and GET /api/users/[id] (with relations). */
export type DoctorProfileWithRelations = DoctorProfile & {
	speciality: Speciality | null;
	cabinetCity: ApplicationCity | null;
};

export type UserWithDoctorProfile = UserRow & {
	doctorProfile: DoctorProfileWithRelations | null;
};

// ─── Availability ─────────────────────────────────────────────────────────────

export type AvailabilitySlot = { start: number; end: number };
export type Availability = Partial<
	Record<0 | 1 | 2 | 3 | 4 | 5 | 6, AvailabilitySlot[]>
>;

// ─── Best-fit doctor ──────────────────────────────────────────────────────────

export type BestFitDoctor = Omit<DoctorProfile, "availability"> & {
	distance: number;
	nextSlot: { start: string; end: string };
};

// ─── Upload ───────────────────────────────────────────────────────────────────

export type SignedUploadUrlResponse = {
	signedUrl: string;
	key: string;
	cdnUrl: string;
};

// ─── Calls ────────────────────────────────────────────────────────────────────

export type CallEventType =
	| "patient_transcript"
	| "ai_transcript"
	| "function_call"
	| "system"
	| "error"
	| "appointment_booked";

export type FunctionCallStatus = "calling" | "success" | "error";

export type CallWithEvents = Call & {
	events: CallEvent[];
};

export type CreateCallEventInput = {
	type: CallEventType;
	content?: string;
	functionName?: string;
	functionArgs?: unknown;
	functionResult?: unknown;
	functionStatus?: FunctionCallStatus;
};

// ─── Stats ────────────────────────────────────────────────────────────────────

export type StatsResponse = {
	total: number;
	admins: number;
	verified: number;
	pending: number;
	rejected: number;
	banned: number;
};
