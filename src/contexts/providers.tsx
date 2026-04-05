"use client";

import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import AlertsProvider from "@/contexts/alerts-provider";
import AppProvider from "@/contexts/app-provider";

export function Providers({ children }: { children: ReactNode }) {
	return (
		<AppProvider>
			<AlertsProvider>
				<TooltipProvider>{children}</TooltipProvider>
			</AlertsProvider>
		</AppProvider>
	);
}
