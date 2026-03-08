import api from "./api";
import type { Appointment, AppointmentWithPatient } from "./types";

// ─── GET /api/appointments ────────────────────────────────────────────────────

export async function getAppointments(params?: { all?: boolean }): Promise<AppointmentWithPatient[]> {
  const { data } = await api.get<AppointmentWithPatient[]>("/api/appointments", {
    params: { all: params?.all ? true : undefined },
  });
  return data;
}

// ─── POST /api/appointments ───────────────────────────────────────────────────

export interface CreateAppointmentInput {
  patientId: number;
  start: string; // ISO datetime
  end: string; // ISO datetime
  name: string;
  description?: string;
}

export async function createAppointment(data: CreateAppointmentInput): Promise<Appointment> {
  const { data: res } = await api.post<Appointment>("/api/appointments", data);
  return res;
}

// ─── PUT /api/appointments ────────────────────────────────────────────────────

export interface UpdateAppointmentInput {
  id: number;
  name?: string;
  description?: string;
  start?: string; // ISO datetime
  end?: string; // ISO datetime
  status?: "pending" | "confirmed" | "cancelled";
}

export async function updateAppointment(data: UpdateAppointmentInput): Promise<Appointment> {
  const { data: res } = await api.put<Appointment>("/api/appointments", data);
  return res;
}

// ─── DELETE /api/appointments ─────────────────────────────────────────────────

export async function deleteAppointment(id: number): Promise<{ message: string }> {
  const { data } = await api.delete<{ message: string }>("/api/appointments", { params: { id } });
  return data;
}

// ─── POST /api/appointments/external ─────────────────────────────────────────

export interface CreateExternalAppointmentInput {
  doctorId: number;
  name: string;
  phoneNumber: string;
  start: string; // ISO datetime
  end: string; // ISO datetime
  illness: string;
}

export async function createExternalAppointment(data: CreateExternalAppointmentInput): Promise<Appointment> {
  const { data: res } = await api.post<Appointment>("/api/appointments/external", data);
  return res;
}
