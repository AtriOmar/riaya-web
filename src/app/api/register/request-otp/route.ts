import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, json, validationError } from "@/lib/api-utils";
import { registry } from "@/lib/openapi";
import { passwordSchema } from "@/lib/password-rules";
import {
	createAndSendRegistrationOtp,
	findUserByEmail,
	normalizeEmail,
} from "@/lib/register-otp";

const requestOtpSchema = z.object({
	email: z.string().email(),
	password: passwordSchema,
});

const requestOtpResponseSchema = z.object({
	email: z.string().email(),
});

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const parsed = requestOtpSchema.safeParse(body);
		if (!parsed.success) return validationError(parsed.error.issues);

		const email = normalizeEmail(parsed.data.email);
		const existing = await findUserByEmail(email);
		if (existing) return apiError("EMAIL_ALREADY_EXISTS");

		await createAndSendRegistrationOtp({
			email,
			password: parsed.data.password,
		});

		return json({ email });
	} catch (e) {
		if (e instanceof Response) return e;
		console.error("request-otp failed", e);
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "post",
	path: "/api/register/request-otp",
	tags: ["Auth"],
	summary: "Request registration OTP",
	request: {
		body: {
			content: { "application/json": { schema: requestOtpSchema } },
		},
	},
	responses: {
		200: {
			description: "OTP sent",
			content: {
				"application/json": { schema: requestOtpResponseSchema },
			},
		},
		409: {
			description: "Email already registered",
		},
	},
});
