import api from "./api";
import type {
  DoctorApplication,
  DoctorApplicationDetail,
  DoctorApplicationSummary,
} from "./types";

// ─── GET /api/doctor-applications ─────────────────────────────────────────────
// Admin-only

export async function getDoctorApplications(): Promise<
  DoctorApplicationSummary[]
> {
  const { data } = await api.get<DoctorApplicationSummary[]>(
    "/api/doctor-applications",
  );
  return data;
}

// ─── POST /api/doctor-applications ────────────────────────────────────────────

export interface CreateDoctorApplicationInput {
  firstName: string;
  lastName: string;
  cinRecto: string; // R2 URL
  cinVerso: string; // R2 URL
  cabinetName: string;
  cabinetCity?: string;
  cabinetLongitude?: number;
  cabinetLatitude?: number;
  specialityId: number;
  tin: string;
}

export async function createDoctorApplication(
  data: CreateDoctorApplicationInput,
): Promise<DoctorApplication> {
  const { data: res } = await api.post<DoctorApplication>(
    "/api/doctor-applications",
    data,
  );
  return res;
}

// ─── GET /api/doctor-applications/me ─────────────────────────────────────────

export async function getMyDoctorApplication(): Promise<DoctorApplicationDetail> {
  const { data } = await api.get<DoctorApplicationDetail>(
    "/api/doctor-applications/me",
  );
  return data;
}

// ─── GET /api/doctor-applications/[id] ───────────────────────────────────────
// Admin-only

export async function getDoctorApplicationById(
  id: number,
): Promise<DoctorApplicationDetail> {
  const { data } = await api.get<DoctorApplicationDetail>(
    `/api/doctor-applications/${id}`,
  );
  return data;
}

// ─── PUT /api/doctor-applications/[id] ───────────────────────────────────────
// Admin-only

export interface UpdateDoctorApplicationInput {
  status: "verified" | "rejected" | "banned";
  rejectionReasons?: string[];
}

export async function updateDoctorApplicationStatus(
  id: number,
  data: UpdateDoctorApplicationInput,
): Promise<{ message: string }> {
  const { data: res } = await api.put<{ message: string }>(
    `/api/doctor-applications/${id}`,
    data,
  );
  return res;
}
