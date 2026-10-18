import { format } from "date-fns";
import { mutate } from "swr";
import type { PostApiBlockedPhonesBodyDuration } from "@/services/generated/api.schemas";

export const CATEGORY_LABELS: Record<
	string,
	{ label: string; className: string }
> = {
	mocking: {
		label: "Mocking",
		className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
	},
	insults: {
		label: "Insults",
		className: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
	},
	threats: { label: "Threats", className: "bg-red-500/15 text-red-600" },
	sexual: { label: "Sexual", className: "bg-red-500/15 text-red-600" },
	other: { label: "Other", className: "bg-muted text-muted-foreground" },
};

export const DURATION_OPTIONS: {
	value: PostApiBlockedPhonesBodyDuration;
	label: string;
}[] = [
	{ value: "7d", label: "7 days" },
	{ value: "30d", label: "30 days" },
	{ value: "permanent", label: "Permanent" },
];

export function formatBlockExpiry(expiresAt: string | null): string {
	return expiresAt
		? `Until ${format(new Date(expiresAt), "d MMM yyyy")}`
		: "Permanent";
}

/** "1st", "2nd", "3rd", "4th"… */
export function ordinal(n: number): string {
	const tens = n % 100;
	if (tens >= 11 && tens <= 13) return `${n}th`;
	return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** Refresh every list that a block, unblock or dismiss can change. */
export function revalidateAbuseData() {
	return mutate(
		(key) =>
			Array.isArray(key) &&
			typeof key[0] === "string" &&
			(key[0].startsWith("/api/call-reports") ||
				key[0].startsWith("/api/blocked-phones") ||
				key[0] === "/api/calls"),
	);
}
