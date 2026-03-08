import api from "./api";
import type { StatsResponse } from "./types";

// ─── GET /api/stats ───────────────────────────────────────────────────────────
// Admin-only

export async function getStats(): Promise<StatsResponse> {
  const { data } = await api.get<StatsResponse>("/api/stats");
  return data;
}
