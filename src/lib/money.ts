/** TND helpers — amounts are stored as integer millimes (1 TND = 1000).
 *  DB columns are still named `*Centimes` for historical reasons. */

export function tndToMillimes(tnd: number): number {
	return Math.round(tnd * 1000);
}

export function millimesToTnd(millimes: number): number {
	return millimes / 1000;
}

export function formatTnd(millimes: number, currency = "TND"): string {
	return `${millimesToTnd(millimes).toLocaleString("fr-TN", {
		minimumFractionDigits: 3,
		maximumFractionDigits: 3,
	})} ${currency}`;
}

/** Parse a TND input string/number into millimes. Returns null if invalid. */
export function parseTndInput(value: string | number): number | null {
	const n = typeof value === "number" ? value : Number(value.replace(",", "."));
	if (!Number.isFinite(n) || n < 0) return null;
	return tndToMillimes(n);
}
