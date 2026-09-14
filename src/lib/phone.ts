import {
	AsYouType,
	type CountryCode,
	getCountryCallingCode,
	parsePhoneNumberFromString,
} from "libphonenumber-js";

/** Default country for doctor dashboard & Tunisia-first product. */
export const DEFAULT_PHONE_COUNTRY: CountryCode = "TN";

export type PhoneCountryOption = {
	code: CountryCode;
	label: string;
};

/** Supported countries in dashboard phone fields (extend when product expands). */
export const PHONE_COUNTRY_OPTIONS: PhoneCountryOption[] = [
	{ code: "TN", label: "Tunisia" },
];

export function phoneCountryFromValue(
	stored: string | null | undefined,
	fallback: CountryCode = DEFAULT_PHONE_COUNTRY,
): CountryCode {
	if (stored == null || !stored.trim()) return fallback;
	const parsed = parsePhoneNumberFromString(stored.trim(), fallback);
	return parsed?.country ?? fallback;
}

function nationalDigitsFromStored(
	stored: string,
	country: CountryCode,
): string {
	const trimmed = stored.trim();
	if (!trimmed) return "";
	const code = getCountryCallingCode(country);

	if (trimmed.startsWith("+")) {
		const international = trimmed.slice(1).replace(/\D/g, "");
		if (international.startsWith(code)) {
			return international.slice(code.length);
		}
		return international;
	}

	const digits = trimmed.replace(/\D/g, "");
	if (digits.startsWith(code)) return digits.slice(code.length);
	return digits;
}

/** National-format string for the number input (formats live via AsYouType). */
export function phoneNationalInputDisplay(
	stored: string | null | undefined,
	country: CountryCode = DEFAULT_PHONE_COUNTRY,
): string {
	if (stored == null || !stored.trim()) return "";
	const nationalDigits = nationalDigitsFromStored(stored.trim(), country);
	if (!nationalDigits) return "";
	return new AsYouType(country).input(nationalDigits);
}

/** E.164-ish value while the user types in the national number field. */
export function phoneValueFromNationalInput(
	nationalInput: string,
	country: CountryCode = DEFAULT_PHONE_COUNTRY,
): string {
	const formatter = new AsYouType(country);
	const formattedNational = formatter.input(nationalInput);
	const nationalDigits = formattedNational.replace(/\D/g, "");
	if (!nationalDigits) return "";
	return `+${getCountryCallingCode(country)}${nationalDigits}`;
}

function parsePhone(
	input: string,
	defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
) {
	const trimmed = input.trim();
	if (!trimmed) return null;

	return (
		parsePhoneNumberFromString(trimmed, defaultCountry) ??
		parsePhoneNumberFromString(
			trimmed.startsWith("+") ? trimmed : `+${trimmed.replace(/\D/g, "")}`,
			defaultCountry,
		)
	);
}

/**
 * Canonical value for DB/API storage: E.164 international, no spaces.
 * Example: `+21671234567`
 */
export function normalizePhoneForStorage(
	input: string | null | undefined,
	defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): string | null {
	if (input == null) return null;
	const trimmed = input.trim();
	if (!trimmed) return null;

	const parsed = parsePhone(trimmed, defaultCountry);
	if (parsed?.isValid()) return parsed.number;

	const digits = trimmed.replace(/\D/g, "");
	if (digits.length < 8) return null;

	const reparsed = parsePhoneNumberFromString(`+${digits}`, defaultCountry);
	if (reparsed?.isValid()) return reparsed.number;

	return `+${digits}`;
}

/** @deprecated Prefer `normalizePhoneForStorage`. Digits only (no `+`). */
export function normalizePhoneDigits(
	input: string | null | undefined,
	defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): string | null {
	const stored = normalizePhoneForStorage(input, defaultCountry);
	return stored ? stored.replace(/\D/g, "") : null;
}

export function isValidPhoneNumber(
	input: string | null | undefined,
	defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): boolean {
	if (input == null || !input.trim()) return false;
	const parsed = parsePhone(input.trim(), defaultCountry);
	return parsed?.isValid() ?? false;
}

/** Human-readable display, e.g. `+216 71 234 567`. */
export function formatPhoneDisplay(
	input: string | null | undefined,
	defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): string {
	if (input == null || !input.trim()) return "—";
	const parsed = parsePhone(input.trim(), defaultCountry);
	if (parsed?.isValid()) return parsed.formatInternational();
	return input.trim();
}

/** Value for phone inputs (`+216…`). */
export function phoneInputValueFromStorage(
	stored: string | null | undefined,
): string | undefined {
	if (stored == null || !stored.trim()) return undefined;
	const trimmed = stored.trim();
	if (trimmed.startsWith("+")) return trimmed;
	const digits = trimmed.replace(/\D/g, "");
	return digits ? `+${digits}` : undefined;
}

/** Lookup keys for legacy rows and equivalent formats. */
export function phoneStorageVariants(stored: string): string[] {
	const trimmed = stored.trim();
	const digits = trimmed.replace(/\D/g, "");
	const e164 = trimmed.startsWith("+")
		? trimmed
		: digits
			? `+${digits}`
			: trimmed;

	const set = new Set<string>();
	if (trimmed) set.add(trimmed);
	if (e164) set.add(e164);
	if (digits) {
		set.add(digits);
		set.add(`+${digits}`);
	}

	if (digits.startsWith("216") && digits.length > 3) {
		const national = digits.slice(3);
		set.add(national);
		if (!national.startsWith("0")) set.add(`0${national}`);
		set.add(`+216${national}`);
	}

	return [...set].filter(Boolean);
}
