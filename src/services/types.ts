// ─── Availability ─────────────────────────────────────────────────────────────

export type { Availability, AvailabilitySlot } from "@/lib/doctor-slots";

// ─── Calls ────────────────────────────────────────────────────────────────────

export type CallEventType =
	| "patient_transcript"
	| "ai_transcript"
	| "function_call"
	| "system"
	| "error"
	| "appointment_booked";

export type FunctionCallStatus = "calling" | "success" | "error";
