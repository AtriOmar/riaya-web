import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { secretaryInvite } from "@/db/schema";
import { personDisplayName } from "@/lib/person-name";

export const SECRETARY_INVITE_TTL_DAYS = 7;

export function hashInviteToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

/** A new invite token (sent once by email) and the hash we store. */
export function newInviteToken(): { token: string; tokenHash: string } {
	const token = randomBytes(32).toString("base64url");
	return { token, tokenHash: hashInviteToken(token) };
}

export function inviteUrl(token: string): string {
	const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
	return `${appUrl}/join/${token}`;
}

/** Invites that can still be accepted. */
export function openInviteFilter(doctorId: number, now = new Date()) {
	return and(
		eq(secretaryInvite.doctorId, doctorId),
		isNull(secretaryInvite.acceptedAt),
		gt(secretaryInvite.expiresAt, now),
	);
}

/** "Dr First Last" for invite emails and the join page. */
export function doctorTitle(doctor: {
	firstName: string | null;
	lastName: string | null;
}): string {
	const name = personDisplayName(doctor);
	return name ? `Dr ${name}` : "Your doctor";
}
