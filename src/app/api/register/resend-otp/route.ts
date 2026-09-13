import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, json, validationError } from "@/lib/api-utils";
import { registry } from "@/lib/openapi";
import {
	findPendingSignup,
	normalizeEmail,
	resendRegistrationOtp,
} from "@/lib/register-otp";

const resendOtpSchema = z.object({
	email: z.string().email(),
});

const resendOtpResponseSchema = z.object({
	email: z.string().email(),
});

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const parsed = resendOtpSchema.safeParse(body);
		if (!parsed.success) return validationError(parsed.error.issues);

		const email = normalizeEmail(parsed.data.email);
		const pending = await findPendingSignup(email);
		if (!pending) return apiError("PENDING_SIGNUP_NOT_FOUND");

		const result = await resendRegistrationOtp(email);
		if (!result.ok) {
			if (result.reason === "cooldown") return apiError("OTP_RATE_LIMITED");
			if (result.reason === "expired") return apiError("OTP_EXPIRED");
			return apiError("PENDING_SIGNUP_NOT_FOUND");
		}

		return json({ email });
	} catch (e) {
		if (e instanceof Response) return e;
		console.error("resend-otp failed", e);
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "post",
	path: "/api/register/resend-otp",
	tags: ["Auth"],
	summary: "Resend registration OTP",
	request: {
		body: {
			content: { "application/json": { schema: resendOtpSchema } },
		},
	},
	responses: {
		200: {
			description: "OTP resent",
			content: {
				"application/json": { schema: resendOtpResponseSchema },
			},
		},
		404: {
			description: "No pending signup",
		},
		429: {
			description: "Resend cooldown active",
		},
	},
});
