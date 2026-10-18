import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AiChatState } from "./use-ai-chat";

/** Icon, conversation title and live status; buttons go before or after. */
export function ChatHeader({
	chat,
	children,
	actions,
	className,
}: {
	chat: AiChatState;
	/** Shown before the icon (e.g. the mobile conversations button). */
	children?: React.ReactNode;
	/** Shown at the end (e.g. history, new chat, close). */
	actions?: React.ReactNode;
	className?: string;
}) {
	const { liveReply } = chat;
	return (
		<header
			className={cn(
				"flex h-16 shrink-0 items-center gap-3 border-b px-3 sm:px-5",
				className,
			)}
		>
			{children}
			<div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
				<Sparkles className="size-4" />
			</div>
			<div className="min-w-0 flex-1">
				<p className="truncate font-semibold text-sm">{chat.headerTitle}</p>
				<p className="flex items-center gap-1.5 text-muted-foreground text-xs">
					{liveReply ? (
						<>
							<span className="size-1.5 animate-pulse rounded-full bg-primary" />
							{liveReply.status === "stopping" ? "Stopping…" : "Responding…"}
						</>
					) : (
						"Riaya AI assistant"
					)}
				</p>
			</div>
			{actions && (
				<div className="flex shrink-0 items-center gap-0.5">{actions}</div>
			)}
		</header>
	);
}
