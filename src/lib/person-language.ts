export const personPreferredLanguages = ["en", "fr", "ar"] as const;
export type PersonPreferredLanguage = (typeof personPreferredLanguages)[number];

export const DEFAULT_PERSON_PREFERRED_LANGUAGE: PersonPreferredLanguage = "ar";

export function isPersonPreferredLanguage(
	value: unknown,
): value is PersonPreferredLanguage {
	return value === "en" || value === "fr" || value === "ar";
}

export function normalizePersonPreferredLanguage(
	value: unknown,
): PersonPreferredLanguage {
	return isPersonPreferredLanguage(value)
		? value
		: DEFAULT_PERSON_PREFERRED_LANGUAGE;
}
