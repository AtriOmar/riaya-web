import { Star } from "lucide-react";
import { mutate } from "swr";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** Mirrors the server's REVIEW_SUMMARY_MIN_REVIEWS and POOR_AVERAGE_BELOW. */
export const MIN_REVIEWS = 5;
export const POOR_AVERAGE_BELOW = 3;

export const WAIT_LABELS: Record<string, string> = {
	short: "Short wait",
	medium: "Medium wait",
	long: "Long wait",
};

export function isPoorAverage(row: {
	averageRating: number | null;
	reviewCount: number;
}) {
	return (
		row.averageRating != null &&
		row.reviewCount >= MIN_REVIEWS &&
		row.averageRating < POOR_AVERAGE_BELOW
	);
}

export const formatRating = (v: number | null) =>
	v == null ? null : v.toFixed(1);

/** "2 of 3" below MIN_REVIEWS answers, a percentage from there; null without answers. */
export function formatLongWaits(row: {
	longWaitCount: number;
	waitCount: number;
}) {
	if (row.waitCount === 0) return null;
	if (row.waitCount < MIN_REVIEWS)
		return `${row.longWaitCount} of ${row.waitCount}`;
	return `${Math.round((row.longWaitCount / row.waitCount) * 100)}%`;
}

/** Shown once per doctor, under the review count, when there are too few reviews. */
export function tooFewCaption(reviewCount: number) {
	return reviewCount > 0 && reviewCount < MIN_REVIEWS
		? "too few to judge"
		: null;
}

/**
 * The 90-day count, only when it alone is too few: the overall count already
 * carries the caption when both are.
 */
export function recentCaption(row: {
	reviewCount: number;
	reviewCount90d: number;
}) {
	return row.reviewCount90d > 0 &&
		row.reviewCount90d < MIN_REVIEWS &&
		row.reviewCount >= MIN_REVIEWS
		? `${row.reviewCount90d} in 90 days`
		: null;
}

/**
 * A rating figure, muted when based on fewer than MIN_REVIEWS reviews, with an
 * optional caption below. Null (nothing to show) is a dash.
 */
export function RatingValue({
	value,
	basedOn,
	danger,
	caption,
	className,
}: {
	value: string | number | null;
	/** How many reviews the value comes from. */
	basedOn: number;
	danger?: boolean;
	caption?: string | null;
	className?: string;
}) {
	if (value == null) {
		return <span className={cn("text-muted-foreground", className)}>—</span>;
	}
	return (
		<span className="inline-flex flex-col">
			<span
				className={cn(
					className,
					basedOn < MIN_REVIEWS && "text-muted-foreground",
					danger && "font-semibold text-destructive",
				)}
			>
				{value}
			</span>
			{caption && (
				<span className="whitespace-nowrap font-normal text-muted-foreground text-xs">
					{caption}
				</span>
			)}
		</span>
	);
}

export function Stars({ value }: { value: number }) {
	return (
		<span
			className="inline-flex gap-0.5"
			role="img"
			aria-label={`${value} out of 5`}
		>
			{[1, 2, 3, 4, 5].map((n) => (
				<Star
					key={n}
					className={cn(
						"size-3.5",
						Math.round(value) >= n
							? "fill-yellow-400 text-yellow-400"
							: "text-muted-foreground/40",
					)}
				/>
			))}
		</span>
	);
}

/** Refetch every rating and exclusion view after a change. */
export function revalidateRatingsData() {
	return mutate(
		(key) =>
			Array.isArray(key) &&
			typeof key[0] === "string" &&
			key[0].startsWith("/api/doctor-ratings"),
	);
}

/** Profile picture with initials fallback, as on the admin users pages. */
export function DoctorAvatar({
	doctor,
	className,
}: {
	doctor: {
		image: string | null;
		firstName: string | null;
		lastName: string | null;
	};
	className?: string;
}) {
	const initials =
		`${doctor.firstName?.[0] ?? ""}${doctor.lastName?.[0] ?? ""}`.toUpperCase() ||
		"DR";
	return (
		<Avatar className={cn("size-8", className)}>
			<AvatarImage src={doctor.image ?? undefined} />
			<AvatarFallback className="text-xs">{initials}</AvatarFallback>
		</Avatar>
	);
}
