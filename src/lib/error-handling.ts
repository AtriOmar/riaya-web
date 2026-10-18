import { isAxiosError } from "axios";
import type { ErrorCode } from "@/lib/errors";
import { errors } from "@/lib/errors";

/** Extract the API error code from an axios / fetch-style error payload. */
export function getApiErrorCode(error: unknown): ErrorCode | null {
	if (isAxiosError(error)) {
		const code = error.response?.data?.error;
		if (code && code in errors) return code as ErrorCode;
		return null;
	}
	if (error && typeof error === "object" && "error" in error) {
		const code = (error as { error?: unknown }).error;
		if (typeof code === "string" && code in errors) return code as ErrorCode;
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
	AI_REPLY_IN_PROGRESS:
		"The assistant is still answering. Wait for it to finish or stop it.",
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
	GEOCODING_FAILED:
		"Address search is unavailable right now. Please try again or place the pin on the map.",
	INVOICE_NOT_FOUND: "Invoice not found.",
	INVOICE_CANCELLED: "This invoice is cancelled and cannot be modified.",
	PAYMENT_NOT_FOUND: "Payment not found.",
	PATIENT_PHONE_REQUIRED:
		"This patient has no phone number. Add one before sending on WhatsApp.",
	PATIENT_ASSIGNMENT_REQUIRED:
		"Choose an existing patient or enable creating a new patient before accepting.",
	PERSON_NOT_ON_PHONE: "This person is not linked to the calling phone number.",
	WHATSAPP_SEND_FAILED:
		"Failed to send WhatsApp message. Check your WhatsApp connection.",
	BILLING_INVOICE_NOT_FOUND: "Billing invoice not found.",
	BILLING_INVOICE_CANCELLED: "This invoice has been cancelled.",
	SUBSCRIPTION_NOT_FOUND: "Subscription not found.",
	WHATSAPP_LIMIT_REACHED:
		"Monthly WhatsApp send limit reached. It resets next calendar month, or upgrade to Pro for unlimited sends.",
	RECORDING_LIMIT_REACHED:
		"You've used all your recording time this month. Add hours or upgrade on the Subscription page.",
	RECORDING_PACKS_REQUIRE_PRO: "Recording hour packs are available on Pro.",
	SUMMARIES_REQUIRE_PRO: "Consultation summaries are available on Pro.",
	TRANSCRIPT_REQUIRED: "Transcribe the recording first.",
	SUMMARY_FAILED: "Couldn't write the summary. Please try again.",
	DOCUMENT_BRANDING_REQUIRES_PRO:
		"Your logo and stamp on invoices are available on Pro.",
	INVALID_BRANDING_IMAGE: "Upload the image again as a PNG or JPEG.",
	SECRETARY_ACCESS_PAUSED:
		"Secretary access is paused because the doctor's plan no longer includes it.",
	SECRETARIES_REQUIRE_PRO: "Secretary accounts are available on Pro.",
	SECRETARY_NOT_FOUND: "Secretary not found.",
	INVITE_NOT_FOUND:
		"This invitation is invalid or has expired. Ask the doctor to send a new one.",
	INVITE_EMAIL_MISMATCH:
		"This invitation was sent to a different email. Sign in with that email to accept it.",
	ALREADY_IN_PRACTICE:
		"This account already belongs to a practice, so it can't join another one.",
	AI_USAGE_LIMIT_REACHED:
		"You've used this month's AI assistant allowance. It resets on the 1st of next month.",
	APPOINTMENT_NOT_CANCELLABLE:
		"This appointment cannot be cancelled by phone. Contact the doctor's office if it is already confirmed.",
	CALLER_PHONE_REQUIRED: "Caller phone number is required for this action.",
	RECORDING_NOT_FOUND: "Recording not found.",
	TRANSCRIPT_ALREADY_DONE: "This recording has already been transcribed.",
	TRANSCRIPTION_FAILED: "Failed to generate transcript. Please try again.",
	CONVERSATION_NOT_FOUND: "Conversation not found.",
	AI_ACTION_NOT_FOUND: "This suggestion no longer exists.",
	AI_ACTION_ALREADY_DECIDED:
		"This suggestion was already confirmed or dismissed.",
	REPORT_NOT_FOUND: "Report not found.",
	BLOCKED_PHONE_NOT_FOUND: "This number is not blocked.",
	PHONE_ALREADY_BLOCKED: "This number is already blocked.",
	LIVEKIT_NOT_CONFIGURED:
		"LiveKit is not configured on the server (missing LIVEKIT_* env vars).",
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
