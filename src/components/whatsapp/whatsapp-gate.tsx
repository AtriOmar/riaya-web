"use client";

import type { ReactNode } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWhatsappStatus } from "@/hooks/use-whatsapp-status";

/**
 * Wraps a "send via WhatsApp" button. The button gets `disabled` while WhatsApp
 * isn't connected, and the wrapper explains why on hover (a disabled button
 * can't show a tooltip itself).
 */
export default function WhatsappGate({
	children,
}: {
	children: (disabled: boolean) => ReactNode;
}) {
	const { notConnected, notConnectedMessage } = useWhatsappStatus();
	if (!notConnected) return <>{children(false)}</>;

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span className="inline-flex">{children(true)}</span>
			</TooltipTrigger>
			<TooltipContent>{notConnectedMessage}</TooltipContent>
		</Tooltip>
	);
}
