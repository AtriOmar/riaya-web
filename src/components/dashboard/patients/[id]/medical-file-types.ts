/** One surface style per type: shared by list badges and the selected type control. */
export const MEDICAL_FILE_TYPES = [
	{
		value: "consultation",
		label: "Consultation",
		accentClassName:
			"border-sky-500/45 bg-sky-500/15 text-sky-900 dark:bg-sky-500/25 dark:text-sky-100 dark:border-sky-500/50",
		typeButtonUnselected:
			"border-border/80 bg-background text-muted-foreground hover:border-sky-500/40 hover:bg-sky-500/15 hover:text-sky-900 dark:hover:border-sky-500/35 dark:hover:bg-sky-500/20 dark:hover:text-sky-100",
	},
	{
		value: "prescription",
		label: "Prescription",
		accentClassName:
			"border-violet-500/45 bg-violet-500/15 text-violet-900 dark:bg-violet-500/25 dark:text-violet-100 dark:border-violet-500/50",
		typeButtonUnselected:
			"border-border/80 bg-background text-muted-foreground hover:border-violet-500/40 hover:bg-violet-500/15 hover:text-violet-900 dark:hover:border-violet-500/35 dark:hover:bg-violet-500/20 dark:hover:text-violet-100",
	},
	{
		value: "lab-report",
		label: "Lab report",
		accentClassName:
			"border-emerald-500/45 bg-emerald-500/15 text-emerald-900 dark:bg-emerald-500/25 dark:text-emerald-100 dark:border-emerald-500/50",
		typeButtonUnselected:
			"border-border/80 bg-background text-muted-foreground hover:border-emerald-500/40 hover:bg-emerald-500/15 hover:text-emerald-900 dark:hover:border-emerald-500/35 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-100",
	},
] as const;

export const MEDICAL_FILE_TYPE_VALUES: readonly string[] =
	MEDICAL_FILE_TYPES.map((t) => t.value);

export function getMedicalFileTypeMeta(value: string) {
	return MEDICAL_FILE_TYPES.find((t) => t.value === value);
}

export function formatMedicalFileType(type: string | null | undefined): string {
	if (!type) return "—";
	return getMedicalFileTypeMeta(type)?.label ?? type;
}

export function medicalFileTypeBadgeClassName(
	type: string | null | undefined,
): string {
	const meta = type ? getMedicalFileTypeMeta(type) : undefined;
	return (
		meta?.accentClassName ?? "border-border bg-muted/50 text-muted-foreground"
	);
}
