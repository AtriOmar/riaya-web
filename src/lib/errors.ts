// ─── API Error Codes ─────────────────────────────────────────────────────────
// Every error returned by the API has a machine-readable `error` field set to
// one of these codes so the client can handle each case deterministically.

export const errors = {
	// Auth
	UNAUTHORIZED: "UNAUTHORIZED",
	FORBIDDEN: "FORBIDDEN",

	// Validation / input
	INVALID_ID: "INVALID_ID",
	VALIDATION_ERROR: "VALIDATION_ERROR",
	INVALID_TIME_RANGE: "INVALID_TIME_RANGE",
	INVALID_DESIRED_TIME: "INVALID_DESIRED_TIME",
	DOCTOR_UNAVAILABLE_DAY: "DOCTOR_UNAVAILABLE_DAY",
	DOCTOR_UNAVAILABLE_TIME: "DOCTOR_UNAVAILABLE_TIME",

	// Conflicts
	APPOINTMENT_CONFLICT: "APPOINTMENT_CONFLICT",

	// Not found (404)
	APPOINTMENT_NOT_FOUND: "APPOINTMENT_NOT_FOUND",
	PATIENT_NOT_FOUND: "PATIENT_NOT_FOUND",
	MEDICAL_FILE_NOT_FOUND: "MEDICAL_FILE_NOT_FOUND",
	DOCTOR_NOT_FOUND: "DOCTOR_NOT_FOUND",
	DOCTOR_PROFILE_NOT_FOUND: "DOCTOR_PROFILE_NOT_FOUND",
	APPLICATION_NOT_FOUND: "APPLICATION_NOT_FOUND",
	SPECIALITY_NOT_FOUND: "SPECIALITY_NOT_FOUND",
	USER_NOT_FOUND: "USER_NOT_FOUND",

	// Server
	INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = keyof typeof errors;

const errorStatus: Record<ErrorCode, number> = {
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	INVALID_ID: 400,
	VALIDATION_ERROR: 400,
	INVALID_TIME_RANGE: 422,
	INVALID_DESIRED_TIME: 422,
	DOCTOR_UNAVAILABLE_DAY: 422,
	DOCTOR_UNAVAILABLE_TIME: 422,
	APPOINTMENT_CONFLICT: 409,
	APPOINTMENT_NOT_FOUND: 404,
	PATIENT_NOT_FOUND: 404,
	MEDICAL_FILE_NOT_FOUND: 404,
	DOCTOR_NOT_FOUND: 404,
	DOCTOR_PROFILE_NOT_FOUND: 404,
	APPLICATION_NOT_FOUND: 404,
	SPECIALITY_NOT_FOUND: 404,
	USER_NOT_FOUND: 404,
	INTERNAL_ERROR: 500,
};

/** Build a JSON Response with a structured error code. */
export function apiError(
	code: ErrorCode,
	extra?: Record<string, unknown>,
): Response {
	const status = errorStatus[code];
	return Response.json(extra ? { error: code, ...extra } : { error: code }, {
		status,
	});
}

/** Throw an API error Response — for use inside `requireX` helpers. */
export function throwApiError(code: ErrorCode): never {
	throw apiError(code);
}
