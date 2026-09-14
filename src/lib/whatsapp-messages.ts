import {
	normalizePersonPreferredLanguage,
	type PersonPreferredLanguage,
} from "@/lib/person-language";

const DATE_LOCALES: Record<PersonPreferredLanguage, string> = {
	en: "en-GB",
	fr: "fr-TN",
	ar: "ar-TN",
};

function lang(value: unknown): PersonPreferredLanguage {
	return normalizePersonPreferredLanguage(value);
}

function fullDoctorName(
	firstName: string | null | undefined,
	lastName: string | null | undefined,
): string {
	return [firstName, lastName]
		.filter((p) => p?.trim())
		.join(" ")
		.trim();
}

function doctorLastOrFull(
	firstName: string | null | undefined,
	lastName: string | null | undefined,
): string {
	return lastName?.trim() || fullDoctorName(firstName, lastName);
}

function titledDoctor(
	language: PersonPreferredLanguage,
	name: string,
	fallback: Record<PersonPreferredLanguage, string>,
): string {
	if (!name) return fallback[language];
	if (language === "fr") return `Dr ${name}`;
	if (language === "en") return `Dr. ${name}`;
	return `الدكتور ${name}`;
}

function formatAppointmentDate(
	language: PersonPreferredLanguage,
	start: Date | null | undefined,
): string {
	if (!start) return "";
	return start.toLocaleString(DATE_LOCALES[language], {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		timeZone: "Africa/Tunis",
	});
}

export function buildAppointmentConfirmationMessage(params: {
	language?: string | null;
	patientName: string;
	doctorFirstName: string | null | undefined;
	doctorLastName: string | null | undefined;
	start: Date | null | undefined;
}): string {
	const language = lang(params.language);
	const rawDoctor = fullDoctorName(
		params.doctorFirstName,
		params.doctorLastName,
	);
	const doctorName = titledDoctor(language, rawDoctor, {
		en: "your doctor",
		fr: "votre médecin",
		ar: "الطبيب",
	});
	const date = formatAppointmentDate(language, params.start);
	const name = params.patientName.trim();

	if (language === "fr") {
		const withDoctor = rawDoctor ? `le ${doctorName}` : doctorName;
		return `Bonjour ${name}, votre rendez-vous avec ${withDoctor} a été confirmé${date ? ` pour le ${date}` : ""}. Merci.`;
	}
	if (language === "en") {
		return `Hello ${name}, your appointment with ${doctorName} has been confirmed${date ? ` for ${date}` : ""}. Thank you.`;
	}
	return `مرحباً ${name}، تم تأكيد موعدك مع ${doctorName}${date ? ` بتاريخ ${date}` : ""}. شكراً لك.`;
}

export function buildInvoiceWhatsappCaption(params: {
	language?: string | null;
	patientFirstName: string | null | undefined;
	invoiceNumber: string;
	doctorFirstName: string | null | undefined;
	doctorLastName: string | null | undefined;
}): string {
	const language = lang(params.language);
	const first = params.patientFirstName?.trim();
	const doctorRaw = doctorLastOrFull(
		params.doctorFirstName,
		params.doctorLastName,
	);
	const doctor = titledDoctor(language, doctorRaw, {
		en: "your doctor",
		fr: "votre médecin",
		ar: "طبيبك",
	});

	if (language === "fr") {
		const hello = first ? `Bonjour ${first}` : "Bonjour";
		const from = doctorRaw ? `du ${doctor}` : `de ${doctor}`;
		return `${hello},\n\nVeuillez trouver ci-joint votre facture ${params.invoiceNumber} ${from}.`;
	}
	if (language === "en") {
		const hello = first ? `Hello ${first}` : "Hello";
		return `${hello},\n\nPlease find attached your invoice ${params.invoiceNumber} from ${doctor}.`;
	}
	const hello = first ? `مرحباً ${first}` : "مرحباً";
	return `${hello}،\n\nتجد رفقته فاتورتك ${params.invoiceNumber} من ${doctor}.`;
}

export function buildMedicalFileWhatsappCaption(params: {
	language?: string | null;
	patientFirstName: string | null | undefined;
	doctorLastName: string | null | undefined;
	doctorFirstName?: string | null;
	title: string | null | undefined;
}): string {
	const language = lang(params.language);
	const first = params.patientFirstName?.trim();
	const doctorRaw = doctorLastOrFull(
		params.doctorFirstName,
		params.doctorLastName,
	);
	const doctor = titledDoctor(language, doctorRaw, {
		en: "your doctor",
		fr: "votre médecin",
		ar: "طبيبك",
	});
	const title = params.title?.trim() || fallbackMedicalTitle(language);

	if (language === "fr") {
		const hello = first ? `Bonjour ${first}` : "Bonjour";
		const from = doctorRaw ? `du ${doctor}` : `de ${doctor}`;
		return `${hello},\n\nVoici votre document ${from} : ${title}`;
	}
	if (language === "en") {
		const hello = first ? `Hello ${first}` : "Hello";
		return `${hello},\n\nHere is your document from ${doctor}: ${title}`;
	}
	const hello = first ? `مرحباً ${first}` : "مرحباً";
	return `${hello}،\n\nإليك مستندك من ${doctor}: ${title}`;
}

export function buildMedicalFileWhatsappText(params: {
	language?: string | null;
	patientFirstName: string | null | undefined;
	doctorLastName: string | null | undefined;
	doctorFirstName?: string | null;
	title: string | null | undefined;
	description: string | null | undefined;
}): string {
	const language = lang(params.language);
	const first = params.patientFirstName?.trim();
	const doctorRaw = doctorLastOrFull(
		params.doctorFirstName,
		params.doctorLastName,
	);
	const doctor = titledDoctor(language, doctorRaw, {
		en: "your doctor",
		fr: "votre médecin",
		ar: "طبيبك",
	});
	const title = params.title?.trim() || fallbackMedicalUpdate(language);
	const notes = params.description?.trim();

	let text: string;
	if (language === "fr") {
		const hello = first ? `Bonjour ${first}` : "Bonjour";
		const from = doctorRaw ? `du ${doctor}` : `de ${doctor}`;
		text = `${hello},\n\nVoici une mise à jour ${from} :\n\n*${title}*`;
		if (notes) text += `\n\nNotes : ${notes}`;
		return text;
	}
	if (language === "en") {
		const hello = first ? `Hello ${first}` : "Hello";
		text = `${hello},\n\nHere is an update from ${doctor}:\n\n*${title}*`;
		if (notes) text += `\n\nNotes: ${notes}`;
		return text;
	}
	const hello = first ? `مرحباً ${first}` : "مرحباً";
	text = `${hello}،\n\nإليك تحديث من ${doctor}:\n\n*${title}*`;
	if (notes) text += `\n\nملاحظات: ${notes}`;
	return text;
}

export function buildReviewWhatsappMessage(params: {
	language?: string | null;
	patientName: string;
	doctorFirstName: string | null | undefined;
	doctorLastName: string | null | undefined;
	link: string;
}): string {
	const language = lang(params.language);
	const name = params.patientName.trim();
	const doctorRaw = doctorLastOrFull(
		params.doctorFirstName,
		params.doctorLastName,
	);
	const doctor = titledDoctor(language, doctorRaw, {
		en: "your doctor",
		fr: "votre médecin",
		ar: "طبيبك",
	});

	if (language === "fr") {
		const visited = doctorRaw ? `le ${doctor}` : doctor;
		return `Bonjour ${name}, merci d'avoir consulté ${visited}. Merci de prendre 30 secondes pour répondre à 3 questions rapides sur votre visite :\n\n${params.link}`;
	}
	if (language === "en") {
		return `Hi ${name}, thanks for visiting ${doctor}. Please take 30 seconds to answer 3 quick questions about your visit:\n\n${params.link}`;
	}
	return `مرحباً ${name}، شكراً لزيارتك ${doctor}. الرجاء تخصيص 30 ثانية للإجابة على 3 أسئلة سريعة حول زيارتك:\n\n${params.link}`;
}

function fallbackMedicalTitle(language: PersonPreferredLanguage): string {
	if (language === "fr") return "Dossier médical";
	if (language === "en") return "Medical File";
	return "ملف طبي";
}

function fallbackMedicalUpdate(language: PersonPreferredLanguage): string {
	if (language === "fr") return "Mise à jour médicale";
	if (language === "en") return "Medical Update";
	return "تحديث طبي";
}
