"use client";

import type { ReactNode } from "react";
import AlertsProvider from "@/components/contexts/alerts-provider";
import AppProvider from "@/components/contexts/app-provider";
import { AuthProvider } from "@/components/contexts/auth-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
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
