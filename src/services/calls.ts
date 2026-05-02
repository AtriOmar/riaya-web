import api from "./api";
import type { CallWithEvents } from "./types";

// ─── GET /api/calls ───────────────────────────────────────────────────────────
// Admin-only. Returns every call with its ordered events.

export async function getCalls(): Promise<CallWithEvents[]> {
	const { data } = await api.get<CallWithEvents[]>("/api/calls");
	return data;
}

// ─── GET /api/calls/[id] ─────────────────────────────────────────────────────

export async function getCallById(id: number): Promise<CallWithEvents> {
	const { data } = await api.get<CallWithEvents>(`/api/calls/${id}`);
	return data;
}
