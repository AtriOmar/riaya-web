import type { InferSelectModel } from "drizzle-orm";
import type {
  appointment,
  patient,
  patientMedicalFile,
  doctorProfile,
  doctorApplication,
  speciality,
} from "@/db/schema";

// ─── Base models ──────────────────────────────────────────────────────────────

export type Appointment = InferSelectModel<typeof appointment>;
export type Patient = InferSelectModel<typeof patient>;
export type PatientMedicalFile = InferSelectModel<typeof patientMedicalFile>;
export type DoctorProfile = InferSelectModel<typeof doctorProfile>;
export type DoctorApplication = InferSelectModel<typeof doctorApplication>;
export type Speciality = InferSelectModel<typeof speciality>;

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
type ApplicationSpeciality = { id: number; name: string | null };

export type DoctorApplicationSummary = DoctorApplication & {
  user: ApplicationUser;
};
export type DoctorApplicationDetail = DoctorApplication & {
  user: ApplicationUser;
  speciality: ApplicationSpeciality | null;
};

export type DoctorProfileWithSpeciality = DoctorProfile & {
  speciality: Speciality | null;
};
export type UserWithDoctorProfile = UserRow & {
  doctorProfile: DoctorProfileWithSpeciality | null;
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

// ─── Stats ────────────────────────────────────────────────────────────────────

export type StatsResponse = {
  total: number;
  admins: number;
  verified: number;
  pending: number;
  rejected: number;
  banned: number;
};
