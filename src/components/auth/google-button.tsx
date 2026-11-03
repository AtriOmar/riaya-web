"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { safeNextPath } from "@/lib/safe-next";

function GoogleLogo() {
	return (
		<svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
			<path
				fill="#4285F4"
				d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81Z"
			/>
			<path
				fill="#34A853"
				d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.1A12 12 0 0 0 12 24Z"
			/>
			<path
				fill="#FBBC05"
				d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.27a12 12 0 0 0 0 10.76l4-3.1Z"
			/>
			<path
				fill="#EA4335"
				d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.62l4 3.1C6.22 6.86 8.87 4.75 12 4.75Z"
			/>
		</svg>
	);
}

export default function GoogleButton({ next }: { next: string | null }) {
	const [isPending, setIsPending] = useState(false);

	async function signIn() {
		setIsPending(true);
		const { error } = await authClient.signIn.social({
			provider: "google",
			callbackURL: safeNextPath(next),
		});
		// On success the browser is redirected to Google, so only errors come back.
		if (error) {
			setIsPending(false);
			toast.error(error.message ?? "Could not continue with Google.");
		}
	}

	return (
		<Button
			type="button"
			variant="quiet"
			size="lg"
			className="w-full h-12"
			disabled={isPending}
			onClick={signIn}
		>
			<GoogleLogo />
			Continue with Google
		</Button>
	);
}

export function OrDivider() {
	return (
		<div className="flex items-center gap-3 my-6 text-muted-foreground text-sm">
			<span className="flex-1 h-px bg-border" />
			or
			<span className="flex-1 h-px bg-border" />
		</div>
	);
}
