import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/schema";
import { apiError, json, validationError } from "@/lib/api-utils";
import { auth } from "@/lib/auth";
import { registry } from "@/lib/openapi";
import {
	decryptPassword,
	deletePendingSignup,
	findPendingSignup,
	findUserByEmail,
	MAX_OTP_ATTEMPTS,
	normalizeEmail,
	OTP_LENGTH,
	otpMatches,
	updatePendingSignupValue,
} from "@/lib/register-otp";

const verifyOtpSchema = z.object({
	email: z.string().email(),
	otp: z.string().length(OTP_LENGTH).regex(/^\d+$/),
});

const verifyOtpResponseSchema = z.object({
	email: z.string().email(),
});

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const parsed = verifyOtpSchema.safeParse(body);
		if (!parsed.success) return validationError(parsed.error.issues);

		const email = normalizeEmail(parsed.data.email);
		const pending = await findPendingSignup(email);
		if (!pending) return apiError("PENDING_SIGNUP_NOT_FOUND");

		if (pending.row.expiresAt.getTime() < Date.now()) {
			await deletePendingSignup(pending.identifier);
			return apiError("OTP_EXPIRED");
		}

		if (pending.value.attempts >= MAX_OTP_ATTEMPTS) {
			return apiError("OTP_RATE_LIMITED");
		}

		if (!otpMatches(parsed.data.otp, pending.value.otpHash)) {
			const nextAttempts = pending.value.attempts + 1;
			await updatePendingSignupValue(
				pending.identifier,
				{ ...pending.value, attempts: nextAttempts },
				pending.row.expiresAt,
			);
			if (nextAttempts >= MAX_OTP_ATTEMPTS) {
				return apiError("OTP_RATE_LIMITED");
			}
			return apiError("INVALID_OTP");
		}

		const existing = await findUserByEmail(email);
		if (existing) {
			await deletePendingSignup(pending.identifier);
			return apiError("EMAIL_ALREADY_EXISTS");
		}

		const password = decryptPassword(pending.value.passwordCiphertext);

		const signUpResponse = await auth.api.signUpEmail({
			body: {
				name: "",
				email,
				password,
			},
		});

		await db
			.update(user)
			.set({ emailVerified: true })
			.where(eq(user.email, email));

		await deletePendingSignup(pending.identifier);

		return json({
			email: signUpResponse.user.email,
		});
	} catch (e) {
		if (e instanceof Response) return e;
		console.error("verify-otp failed", e);
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "post",
	path: "/api/register/verify-otp",
	tags: ["Auth"],
	summary: "Verify registration OTP and create account",
	request: {
		body: {
			content: { "application/json": { schema: verifyOtpSchema } },
		},
	},
	responses: {
		200: {
			description: "Account created",
			content: {
				"application/json": { schema: verifyOtpResponseSchema },
			},
		},
		400: {
			description: "Invalid or expired OTP",
		},
		404: {
			description: "No pending signup",
		},
	},
});
