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
	EMAIL_ALREADY_EXISTS: "An account with this email already exists.",
	APPOINTMENT_NOT_FOUND: "Appointment not found.",
	PATIENT_NOT_FOUND: "Patient not found.",
	MEDICAL_FILE_NOT_FOUND: "Medical file not found.",
	DOCTOR_NOT_FOUND: "Doctor not found.",
	DOCTOR_PROFILE_NOT_FOUND: "Doctor profile not found.",
	APPLICATION_NOT_FOUND: "Application not found.",
	SPECIALITY_NOT_FOUND: "Speciality not found.",
	USER_NOT_FOUND: "User not found.",
	INVALID_OTP: "Invalid verification code. Please try again.",
	OTP_EXPIRED: "This code has expired. Please request a new one.",
	OTP_RATE_LIMITED: "Too many attempts. Please wait and try again.",
	PENDING_SIGNUP_NOT_FOUND:
		"No pending registration found. Please start again.",
	INVOICE_NOT_FOUND: "Invoice not found.",
	INVOICE_CANCELLED: "This invoice is cancelled and cannot be modified.",
	PAYMENT_NOT_FOUND: "Payment not found.",
	PATIENT_PHONE_REQUIRED:
		"This patient has no phone number. Add one before sending on WhatsApp.",
	PATIENT_ASSIGNMENT_REQUIRED:
		"Choose an existing patient or enable creating a new patient before accepting.",
	WHATSAPP_SEND_FAILED:
		"Failed to send WhatsApp message. Check your WhatsApp connection.",
	BILLING_INVOICE_NOT_FOUND: "Billing invoice not found.",
	BILLING_INVOICE_CANCELLED: "This invoice has been cancelled.",
	SUBSCRIPTION_NOT_FOUND: "Subscription not found.",
	AI_BOOKING_LIMIT_REACHED:
		"Monthly AI booking limit reached for this practice. It resets next calendar month, or upgrade to Pro for unlimited bookings.",
	WHATSAPP_LIMIT_REACHED:
		"Monthly WhatsApp send limit reached. It resets next calendar month, or upgrade to Pro for unlimited sends.",
	INTERNAL_ERROR: "An internal error occurred. Please try again later.",
};

/** Get a user-friendly message for an error. */
export function getErrorMessage(error: unknown, fallback?: string): string {
	const code = getApiErrorCode(error);
	if (code && errorMessages[code]) return errorMessages[code];
	if (isAxiosError(error)) return fallback ?? "Something went wrong.";
	if (error instanceof Error) return error.message;
	return fallback ?? "Something went wrong.";
}
