"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";
import { type AuthSession, authClient } from "@/lib/auth-client";

type UseSessionResult = ReturnType<typeof authClient.useSession>;

type AuthContextValue = {
	session: AuthSession | null;
	user: AuthSession["user"] | undefined;
	isPending: UseSessionResult["isPending"];
	isRefetching: UseSessionResult["isRefetching"];
	error: UseSessionResult["error"];
	refetch: UseSessionResult["refetch"];
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
	children,
	initialSession,
}: {
	children: ReactNode;
	initialSession: AuthSession | null;
}) {
	const {
		data: clientSession,
		isPending,
		isRefetching,
		error,
		refetch,
	} = authClient.useSession();

	const session = useMemo(() => {
		if (!isPending) return clientSession ?? null;
		return initialSession;
	}, [isPending, clientSession, initialSession]);

	const value = useMemo<AuthContextValue>(
		() => ({
			session,
			user: session?.user,
			isPending,
			isRefetching,
			error,
			refetch,
		}),
		[session, isPending, isRefetching, error, refetch],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within AuthProvider");
	return ctx;
}
