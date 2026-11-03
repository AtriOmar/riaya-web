import { isLanguage, type Language, languages } from "@/lib/language";

export const personPreferredLanguages = languages;
export type PersonPreferredLanguage = Language;

export const DEFAULT_PERSON_PREFERRED_LANGUAGE: PersonPreferredLanguage = "ar";

export const isPersonPreferredLanguage = isLanguage;

export function normalizePersonPreferredLanguage(
	value: unknown,
): PersonPreferredLanguage {
	return isPersonPreferredLanguage(value)
		? value
		: DEFAULT_PERSON_PREFERRED_LANGUAGE;
}
