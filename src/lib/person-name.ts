/** "First Last", or "" when there is no name yet. Safe in client components. */
export function personDisplayName(
	p: { firstName: string | null; lastName: string | null } | null | undefined,
): string {
	return [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim();
}
