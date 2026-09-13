import nodemailer from "nodemailer";
import { buildRegistrationOtpEmail } from "@/lib/emails/registration-otp";

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required env var: ${name}`);
	}
	return value;
}

function getTransport() {
	const host = requireEnv("MAIL_HOST");
	const user = requireEnv("EMAIL");
	const pass = requireEnv("PASSWORD");
	const port = Number(process.env.MAIL_PORT ?? 587);

	return nodemailer.createTransport({
		host,
		port,
		secure: port === 465,
		auth: { user, pass },
	});
}

export async function sendMail(params: {
	to: string;
	subject: string;
	text: string;
	html: string;
}) {
	const from = process.env.MAIL_FROM ?? requireEnv("EMAIL");
	const transport = getTransport();
	await transport.sendMail({
		from,
		to: params.to,
		subject: params.subject,
		text: params.text,
		html: params.html,
	});
}

export async function sendRegistrationOtpEmail(params: {
	to: string;
	otp: string;
	expiresInMinutes: number;
}) {
	const { subject, text, html } = buildRegistrationOtpEmail({
		otp: params.otp,
		expiresInMinutes: params.expiresInMinutes,
	});
	await sendMail({ to: params.to, subject, text, html });
}
