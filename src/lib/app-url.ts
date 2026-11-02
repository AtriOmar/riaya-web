/** Public origin of the app, without a trailing slash. Throws when NEXT_PUBLIC_APP_URL is not set. */
export function getAppUrl(): string {
	const url = process.env.NEXT_PUBLIC_APP_URL;
	if (!url) {
		throw new Error("NEXT_PUBLIC_APP_URL is not set");
	}
	return url.replace(/\/$/, "");
}
