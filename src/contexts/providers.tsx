"use client";

import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import AlertsProvider from "@/contexts/alerts-provider";
import AppProvider from "@/contexts/app-provider";
import { AuthProvider } from "@/contexts/auth-provider";
import type { AuthSession } from "@/lib/auth-client";

export function Providers({
	children,
	initialSession,
}: {
	children: ReactNode;
	initialSession: AuthSession | null;
}) {
	return (
		<AuthProvider initialSession={initialSession}>
			<AppProvider>
				<AlertsProvider>
					<TooltipProvider>{children}</TooltipProvider>
				</AlertsProvider>
			</AppProvider>
		</AuthProvider>
	);
}
