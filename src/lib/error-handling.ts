import { isAxiosError } from "axios";
import type { ErrorCode } from "@/lib/errors";
import { errors } from "@/lib/errors";

/** Extract the API error code from an axios error response. */
export function getApiErrorCode(error: unknown): ErrorCode | null {
	if (isAxiosError(error)) {
		const code = error.response?.data?.error;
		if (code && code in errors) return code as ErrorCode;
	}
	return null;
}

/** Map of error codes to user-friendly messages. Extend as needed. */
const errorMessages: Partial<Record<ErrorCode, string>> = {
	UNAUTHORIZED: "You must be logged in to perform this action.",
	FORBIDDEN: "You do not have permission to do this.",
	INVALID_ID: "Invalid identifier.",
	VALIDATION_ERROR: "Please check your input and try again.",
	INVALID_TIME_RANGE: "The selected time range is invalid.",
	INVALID_DESIRED_TIME: "The desired time is invalid.",
	DOCTOR_UNAVAILABLE_DAY: "The doctor is not available on this day.",
	DOCTOR_UNAVAILABLE_TIME: "The doctor is not available at this time.",
	APPOINTMENT_CONFLICT:
		"This time slot conflicts with an existing appointment.",
	APPOINTMENT_NOT_FOUND: "Appointment not found.",
	PATIENT_NOT_FOUND: "Patient not found.",
	MEDICAL_FILE_NOT_FOUND: "Medical file not found.",
	DOCTOR_NOT_FOUND: "Doctor not found.",
	DOCTOR_PROFILE_NOT_FOUND: "Doctor profile not found.",
	APPLICATION_NOT_FOUND: "Application not found.",
	SPECIALITY_NOT_FOUND: "Speciality not found.",
	USER_NOT_FOUND: "User not found.",
	INTERNAL_ERROR: "An internal error occurred. Please try again later.",
};

/** Get a user-friendly message for an error. */
export function getErrorMessage(error: unknown): string {
	const code = getApiErrorCode(error);
	if (code && errorMessages[code]) return errorMessages[code];
	if (error instanceof Error) return error.message;
	return "Something went wrong.";
}
