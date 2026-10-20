/** Where to go after sign-in: only same-site paths, never another origin. */
export function safeNextPath(next: string | null | undefined): string {
	return next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

/** `?next=` (and optional `email=`) query string to carry between login and register. */
export function authQuery(next: string | null, email?: string | null): string {
	const params = new URLSearchParams();
	if (next) params.set("next", next);
	if (email) params.set("email", email);
	const query = params.toString();
	return query ? `?${query}` : "";
}
