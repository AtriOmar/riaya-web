import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
	randomInt,
	timingSafeEqual,
} from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user, verification } from "@/db/schema";
import { sendRegistrationOtpEmail } from "@/lib/mailer";

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_TTL_MINUTES = 10;
export const MAX_OTP_ATTEMPTS = 5;
export const RESEND_COOLDOWN_MS = 60 * 1000;

export type PendingSignupValue = {
	otpHash: string;
	passwordCiphertext: string;
	attempts: number;
	lastSentAt: number;
};

export function normalizeEmail(email: string) {
	return email.trim().toLowerCase();
}

export function registerOtpIdentifier(email: string) {
	return `register-otp:${normalizeEmail(email)}`;
}

function getEncryptionKey() {
	const secret = process.env.BETTER_AUTH_SECRET;
	if (!secret) {
		throw new Error("Missing required env var: BETTER_AUTH_SECRET");
	}
	return createHash("sha256").update(secret).digest();
}

export function encryptPassword(password: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
	const encrypted = Buffer.concat([
		cipher.update(password, "utf8"),
		cipher.final(),
	]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptPassword(ciphertext: string): string {
	const buf = Buffer.from(ciphertext, "base64");
	const iv = buf.subarray(0, 12);
	const tag = buf.subarray(12, 28);
	const data = buf.subarray(28);
	const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(data), decipher.final()]).toString(
		"utf8",
	);
}

export function generateOtp(): string {
	return String(randomInt(0, 1_000_000)).padStart(OTP_LENGTH, "0");
}

export function hashOtp(otp: string): string {
	return createHash("sha256").update(otp).digest("hex");
}

export function otpMatches(otp: string, otpHash: string): boolean {
	const a = Buffer.from(hashOtp(otp), "hex");
	const b = Buffer.from(otpHash, "hex");
	if (a.length !== b.length) return false;
	return timingSafeEqual(a, b);
}

export function parsePendingSignupValue(
	raw: string,
): PendingSignupValue | null {
	try {
		const parsed = JSON.parse(raw) as PendingSignupValue;
		if (
			typeof parsed.otpHash !== "string" ||
			typeof parsed.passwordCiphertext !== "string" ||
			typeof parsed.attempts !== "number" ||
			typeof parsed.lastSentAt !== "number"
		) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

export async function findUserByEmail(email: string) {
	const normalized = normalizeEmail(email);
	const [existing] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.email, normalized))
		.limit(1);
	return existing ?? null;
}

export async function findPendingSignup(email: string) {
	const identifier = registerOtpIdentifier(email);
	const [row] = await db
		.select()
		.from(verification)
		.where(eq(verification.identifier, identifier))
		.limit(1);
	if (!row) return null;
	const value = parsePendingSignupValue(row.value);
	if (!value) return null;
	return { row, value, identifier };
}

export async function upsertPendingSignup(params: {
	email: string;
	password: string;
	otp: string;
	previousPasswordCiphertext?: string;
}) {
	const identifier = registerOtpIdentifier(params.email);
	const now = Date.now();
	const value: PendingSignupValue = {
		otpHash: hashOtp(params.otp),
		passwordCiphertext:
			params.previousPasswordCiphertext ?? encryptPassword(params.password),
		attempts: 0,
		lastSentAt: now,
	};

	await db.delete(verification).where(eq(verification.identifier, identifier));
	await db.insert(verification).values({
		id: crypto.randomUUID(),
		identifier,
		value: JSON.stringify(value),
		expiresAt: new Date(now + OTP_TTL_MS),
	});
}

export async function updatePendingSignupValue(
	identifier: string,
	value: PendingSignupValue,
	expiresAt: Date,
) {
	await db
		.update(verification)
		.set({
			value: JSON.stringify(value),
			expiresAt,
			updatedAt: new Date(),
		})
		.where(eq(verification.identifier, identifier));
}

export async function deletePendingSignup(identifier: string) {
	await db.delete(verification).where(eq(verification.identifier, identifier));
}

export async function createAndSendRegistrationOtp(params: {
	email: string;
	password: string;
}) {
	const otp = generateOtp();
	await upsertPendingSignup({
		email: params.email,
		password: params.password,
		otp,
	});
	await sendRegistrationOtpEmail({
		to: normalizeEmail(params.email),
		otp,
		expiresInMinutes: OTP_TTL_MINUTES,
	});
}

export async function resendRegistrationOtp(email: string) {
	const pending = await findPendingSignup(email);
	if (!pending) return { ok: false as const, reason: "not_found" as const };
	if (pending.row.expiresAt.getTime() < Date.now()) {
		await deletePendingSignup(pending.identifier);
		return { ok: false as const, reason: "expired" as const };
	}
	if (Date.now() - pending.value.lastSentAt < RESEND_COOLDOWN_MS) {
		return { ok: false as const, reason: "cooldown" as const };
	}

	const otp = generateOtp();
	const now = Date.now();
	const nextValue: PendingSignupValue = {
		...pending.value,
		otpHash: hashOtp(otp),
		attempts: 0,
		lastSentAt: now,
	};
	await updatePendingSignupValue(
		pending.identifier,
		nextValue,
		new Date(now + OTP_TTL_MS),
	);
	await sendRegistrationOtpEmail({
		to: normalizeEmail(email),
		otp,
		expiresInMinutes: OTP_TTL_MINUTES,
	});
	return { ok: true as const };
}
