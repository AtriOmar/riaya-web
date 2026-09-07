/** Shared calendar defaults for best-fit views. */
export const DEFAULT_MIN_HOUR = 8;
export const DEFAULT_MAX_HOUR = 18;

/**
 * Five distinct colour themes for doctor chips.
 * Rank within a slot maps to a colour so the top fit stays primary.
 */
export const CHIP_COLORS = [
	"bg-primary/15 text-primary border-primary/25 hover:bg-primary/25",
	"bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/25 hover:bg-sky-500/25",
	"bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/25 hover:bg-violet-500/25",
	"bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25 hover:bg-amber-500/25",
	"bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/25",
] as const;
