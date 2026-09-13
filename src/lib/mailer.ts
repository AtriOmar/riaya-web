import nodemailer from "nodemailer";

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
	const subject = "Your Riaya verification code";
	const text = `Your Riaya verification code is ${params.otp}. It expires in ${params.expiresInMinutes} minutes. If you did not request this, you can ignore this email.`;
	const html = `
		<div style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
			<p>Your Riaya verification code is:</p>
			<p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">${params.otp}</p>
			<p>This code expires in ${params.expiresInMinutes} minutes.</p>
			<p style="color: #666;">If you did not request this, you can ignore this email.</p>
		</div>
	`;
	await sendMail({ to: params.to, subject, text, html });
}
