// ─── API Error Codes ─────────────────────────────────────────────────────────
// Every error returned by the API has a machine-readable `error` field set to
// one of these codes so the client can handle each case deterministically.

export const errors = {
  // Auth
  UNAUTHORIZED: { status: 401 },
  FORBIDDEN: { status: 403 },

  // Validation / input
  INVALID_ID: { status: 400 },
  VALIDATION_ERROR: { status: 400 },
  INVALID_TIME_RANGE: { status: 422 },
  INVALID_DESIRED_TIME: { status: 422 },
  DOCTOR_UNAVAILABLE_DAY: { status: 422 },
  DOCTOR_UNAVAILABLE_TIME: { status: 422 },

  // Conflicts
  APPOINTMENT_CONFLICT: { status: 409 },

  // Not found (404)
  APPOINTMENT_NOT_FOUND: { status: 404 },
  PATIENT_NOT_FOUND: { status: 404 },
  MEDICAL_FILE_NOT_FOUND: { status: 404 },
  DOCTOR_NOT_FOUND: { status: 404 },
  DOCTOR_PROFILE_NOT_FOUND: { status: 404 },
  APPLICATION_NOT_FOUND: { status: 404 },
  SPECIALITY_NOT_FOUND: { status: 404 },
  USER_NOT_FOUND: { status: 404 },

  // Server
  INTERNAL_ERROR: { status: 500 },
} as const;

export type ErrorCode = keyof typeof errors;

/** Build a JSON Response with a structured error code. */
export function apiError(code: ErrorCode, extra?: Record<string, unknown>): Response {
  const { status } = errors[code];
  return Response.json(extra ? { error: code, ...extra } : { error: code }, { status });
}

/** Throw an API error Response — for use inside `requireX` helpers. */
export function throwApiError(code: ErrorCode): never {
  throw apiError(code);
}
