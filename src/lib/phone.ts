import {
	type CountryCode,
	parsePhoneNumberFromString,
} from "libphonenumber-js";

/** Default country for doctor dashboard & Tunisia-first product. */
export const DEFAULT_PHONE_COUNTRY: CountryCode = "TN";

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

/** Value for `react-phone-number-input` (`+216…`). */
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
