"use client";

import { notFound, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/contexts/auth-provider";
import type { AppUser } from "@/lib/auth-client";

export type PrivateRouteMode = "authenticated" | "guest";

function isAccessDeniedByRule(
	user: AppUser,
	accessIdMaxExclusive?: number,
	accessIdMinInclusive?: number,
): boolean {
	if (accessIdMinInclusive != null) {
		if (user.accessId == null || user.accessId < accessIdMinInclusive) {
			return true;
		}
	}
	if (accessIdMaxExclusive != null) {
		if (user.accessId != null && user.accessId >= accessIdMaxExclusive) {
			return true;
		}
	}
	return false;
}

export type PrivateRouteProps = {
	children: React.ReactNode;
	/**
	 * authenticated: only signed-in users may view children.
	 * guest: only signed-out users may view children.
	 */
	mode: PrivateRouteMode;
	/**
	 * Where to send the user when they fail the mode check:
	 * - authenticated + no session → redirectTo
	 * - guest + session → redirectTo
	 */
	redirectTo: string;
	/** Shown while resolving session or while a redirect is in progress. */
	fallback?: React.ReactNode;
	/**
	 * When set, access is denied if `user.accessId != null && user.accessId >= accessIdMaxExclusive`
	 * (e.g. dashboard: keep non-admin users; use `3` to send admins elsewhere).
	 */
	accessIdMaxExclusive?: number;
	/**
	 * When set, access is denied if `user.accessId == null || user.accessId < accessIdMinInclusive`
	 * (e.g. admin: use `3` to require admin level).
	 */
	accessIdMinInclusive?: number;
	/**
	 * When access rules deny the user.
	 * notFound: render the Next.js 404 page.
	 */
	onAccessDenied?: "redirect" | "notFound";
	/** Used when onAccessDenied is "redirect"; defaults to `redirectTo` if omitted. */
	accessDeniedRedirect?: string;
};

export default function PrivateRoute({
	children,
	mode,
	redirectTo,
	fallback = null,
	accessIdMaxExclusive,
	accessIdMinInclusive,
	onAccessDenied = "redirect",
	accessDeniedRedirect,
}: PrivateRouteProps) {
	const { user, isPending } = useAuth();
	const router = useRouter();

	const denied =
		mode === "authenticated" &&
		!!user &&
		isAccessDeniedByRule(user, accessIdMaxExclusive, accessIdMinInclusive);

	const deniedRedirectTarget = accessDeniedRedirect ?? redirectTo;

	// Guest routes: redirect as soon as we know there is a session (including SSR).
	useEffect(() => {
		if (mode === "guest" && user) {
			router.replace(redirectTo);
		}
	}, [mode, user, redirectTo, router]);

	// Authenticated routes: only send unauthenticated users away after the client session has settled.
	useEffect(() => {
		if (isPending) return;
		if (mode === "authenticated" && !user) {
			router.replace(redirectTo);
		}
	}, [isPending, mode, user, redirectTo, router]);

	useEffect(() => {
		if (isPending) return;
		if (!denied) return;
		if (onAccessDenied === "redirect") {
			router.replace(deniedRedirectTarget);
		}
	}, [isPending, denied, onAccessDenied, deniedRedirectTarget, router]);

	if (mode === "guest" && user) {
		return <>{fallback}</>;
	}

	// Guest routes: wait until the client session has settled so we do not flash guest UI for signed-in users.
	if (mode === "guest" && isPending) {
		return <>{fallback}</>;
	}

	if (mode === "authenticated" && isPending && !user) {
		return <>{fallback}</>;
	}

	if (mode === "authenticated" && !isPending && !user) {
		return <>{fallback}</>;
	}

	if (denied) {
		if (onAccessDenied === "notFound") {
			notFound();
		}
		return <>{fallback}</>;
	}

	return <>{children}</>;
}
