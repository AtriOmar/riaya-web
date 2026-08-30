// ─── Availability ─────────────────────────────────────────────────────────────

export type AvailabilitySlot = { start: number; end: number };
export type Availability = Partial<
	Record<0 | 1 | 2 | 3 | 4 | 5 | 6, AvailabilitySlot[]>
>;

// ─── Calls ────────────────────────────────────────────────────────────────────

export type CallEventType =
	| "patient_transcript"
	| "ai_transcript"
	| "function_call"
	| "system"
	| "error"
	| "appointment_booked";

export type FunctionCallStatus = "calling" | "success" | "error";
