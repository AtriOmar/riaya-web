import api from "./api";
import type { Availability, DoctorProfile, UserAdminUpdateResult, UserRow, UserWithDoctorProfile } from "./types";

// ─── GET /api/users ───────────────────────────────────────────────────────────
// Admin-only

export async function getUsers(params?: { search?: string }): Promise<UserRow[]> {
  const { data } = await api.get<UserRow[]>("/api/users", { params });
  return data;
}

// ─── PUT /api/users ───────────────────────────────────────────────────────────
// Authenticated doctor updates their own availability schedule

export async function updateAvailability(availability: Availability): Promise<DoctorProfile> {
  const { data } = await api.put<DoctorProfile>("/api/users", { availability });
  return data;
}

// ─── GET /api/users/[id] ─────────────────────────────────────────────────────

export async function getUserById(id: string): Promise<UserWithDoctorProfile> {
  const { data } = await api.get<UserWithDoctorProfile>(`/api/users/${id}`);
  return data;
}

// ─── PUT /api/users/[id] ─────────────────────────────────────────────────────
// Admin-only

export interface AdminUpdateUserInput {
  status?: string;
  accessId?: number;
}

export async function adminUpdateUser(id: string, data: AdminUpdateUserInput): Promise<UserAdminUpdateResult> {
  const { data: res } = await api.put<UserAdminUpdateResult>(`/api/users/${id}`, data);
  return res;
}

// ─── PUT /api/users/picture ───────────────────────────────────────────────────

export async function updateProfilePicture(pictureUrl: string): Promise<{ message: string }> {
  const { data } = await api.put<{ message: string }>("/api/users/picture", { pictureUrl });
  return data;
}
