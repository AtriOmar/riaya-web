import api from "./api";
import type {
	Patient,
	PatientMedicalFile,
	PatientSummary,
	PatientWithMedicalFiles,
} from "./types";

// ─── GET /api/patients ────────────────────────────────────────────────────────

export async function getPatients(params?: {
	search?: string;
	all?: boolean;
}): Promise<PatientSummary[]> {
	const { data } = await api.get<PatientSummary[]>("/api/patients", {
		params: { search: params?.search, all: params?.all ? true : undefined },
	});
	return data;
}

// ─── POST /api/patients ───────────────────────────────────────────────────────

export interface CreatePatientInput {
	cin: string;
	firstName: string;
	lastName: string;
	dateOfBirth: string; // ISO datetime
	gender: string;
	address: string;
	phoneNumber: string;
}

export async function createPatient(
	data: CreatePatientInput,
): Promise<Patient> {
	const { data: res } = await api.post<Patient>("/api/patients", data);
	return res;
}

// ─── GET /api/patients/[id] ──────────────────────────────────────────────────

export async function getPatientById(
	id: number,
): Promise<PatientWithMedicalFiles> {
	const { data } = await api.get<PatientWithMedicalFiles>(
		`/api/patients/${id}`,
	);
	return data;
}

// ─── POST /api/patients/[id]/medical-files ───────────────────────────────────

export interface CreateMedicalFileInput {
	type: string;
	date: string; // ISO datetime
	title: string;
	description: string;
	documents?: string[]; // R2 URLs
}

export async function createMedicalFile(
	patientId: number,
	data: CreateMedicalFileInput,
): Promise<PatientMedicalFile> {
	const { data: res } = await api.post<PatientMedicalFile>(
		`/api/patients/${patientId}/medical-files`,
		data,
	);
	return res;
}

// ─── PUT /api/patients/[id]/medical-files ────────────────────────────────────

export interface UpdateMedicalFileInput {
	medicalFileId: number;
	title?: string;
	description?: string;
}

export async function updateMedicalFile(
	patientId: number,
	data: UpdateMedicalFileInput,
): Promise<PatientMedicalFile> {
	const { data: res } = await api.put<PatientMedicalFile>(
		`/api/patients/${patientId}/medical-files`,
		data,
	);
	return res;
}
