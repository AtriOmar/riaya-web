/** Languages the platform speaks: English, French and Arabic (Tunisian Derja). */
export const languages = ["en", "fr", "ar"] as const;
export type Language = (typeof languages)[number];

export function isLanguage(value: unknown): value is Language {
	return languages.includes(value as Language);
}

/** Name used inside AI prompts. */
export const languageNames: Record<Language, string> = {
	en: "English",
	fr: "French",
	ar: "Arabic",
};

export const DEFAULT_LANGUAGE: Language = "fr";

export function normalizeLanguage(value: unknown): Language {
	return isLanguage(value) ? value : DEFAULT_LANGUAGE;
}
