"use client";

import {
	CalendarDays,
	FilePlus2,
	History,
	Plus,
	Sparkles,
	UserRound,
	X,
} from "lucide-react";
import { usePathname } from "next/navigation";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMediaQuery } from "@/hooks/use-media-query";
import { usePractice } from "@/hooks/use-practice";
import { cn } from "@/lib/utils";
import { ChatHeader } from "./chat-header";
import { ChatThread, type Suggestion } from "./chat-thread";
import { ConversationList } from "./conversation-list";
import { type AiChatState, useAiChat } from "./use-ai-chat";

// ─── The assistant on every dashboard page ────────────────────────────────────
// A button bottom-right opens the assistant in a panel on the right. On wide
// screens the panel is docked and the page makes room for it; below that it
// opens over the page. The chat lives as long as the dashboard does, so moving
// between pages or closing the panel keeps the conversation.

const STORAGE_KEY = "dashboard-ai-panel-open";

/** From this width the panel docks and pushes the page; below it, it overlays. */
const DOCK_QUERY = "(min-width: 1280px)";

type AiPanelContextValue = {
	/** The assistant can be opened here (doctors, not on the AI page itself). */
	available: boolean;
	open: boolean;
	setOpen: (open: boolean) => void;
	/** The panel is docked, so the page must leave room for it. */
	docked: boolean;
};

const AiPanelContext = createContext<AiPanelContextValue | null>(null);

export function useAiPanel() {
	const value = useContext(AiPanelContext);
	if (!value) throw new Error("useAiPanel must be used inside AiPanelProvider");
	return value;
}

export function AiPanelProvider({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const { isSecretary, canWork } = usePractice();
	const wide = useMediaQuery(DOCK_QUERY);
	const [open, setOpenState] = useState(false);

	// AI chat is doctor-only, like its page
	const available =
		canWork && !isSecretary && !pathname.startsWith("/dashboard/ai-chat");

	useEffect(() => {
		try {
			if (localStorage.getItem(STORAGE_KEY) === "true") setOpenState(true);
		} catch {
			// Storage blocked: start closed
		}
	}, []);

	const setOpen = useCallback((next: boolean) => {
		setOpenState(next);
		try {
			localStorage.setItem(STORAGE_KEY, String(next));
		} catch {
			// Storage blocked: the choice just isn't remembered
		}
	}, []);

	// ⌘J / Ctrl+J opens and closes it
	useEffect(() => {
		if (!available) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key.toLowerCase() === "j" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setOpen(!open);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [available, open, setOpen]);

	const value = useMemo(
		() => ({ available, open, setOpen, docked: available && open && wide }),
		[available, open, setOpen, wide],
	);

	return (
		<AiPanelContext.Provider value={value}>
			{children}
			{available && <AiPanel wide={wide} />}
		</AiPanelContext.Provider>
	);
}

/** Suggestions about the page the doctor opened the assistant from. */
function pageSuggestions(pathname: string): Suggestion[] {
	if (/^\/dashboard\/patients\/\d+/.test(pathname)) {
		return [
			{
				label: "Brief me on this patient",
				description: "History, notes and what's due",
				prompt: "Brief me on this patient.",
				icon: UserRound,
			},
			{
				label: "Write a note",
				description: "And save it to their file",
				prompt:
					"Help me write a consultation note for this patient, then propose saving it to their file.",
				icon: FilePlus2,
			},
		];
	}
	if (pathname.startsWith("/dashboard/appointments")) {
		return [
			{
				label: "My week",
				description: "Who's coming in the next 7 days",
				prompt: "What does my schedule look like for the next 7 days?",
				icon: CalendarDays,
			},
		];
	}
	return [];
}

function AiPanel({ wide }: { wide: boolean }) {
	const { open, setOpen } = useAiPanel();
	const pathname = usePathname();
	const chat = useAiChat({ page: pathname, autoFocus: false });

	// Put the cursor in the composer whenever the panel opens
	useEffect(() => {
		if (!open) return;
		const id = requestAnimationFrame(() => chat.textareaRef.current?.focus());
		return () => cancelAnimationFrame(id);
	}, [open, chat.textareaRef]);

	const body = (
		<PanelBody
			chat={chat}
			leadSuggestions={pageSuggestions(pathname)}
			onClose={() => setOpen(false)}
		/>
	);

	return (
		<>
			{wide ? (
				open && (
					<aside
						aria-label="AI assistant"
						className="fixed top-[70px] right-[15px] bottom-[15px] z-30 flex w-[420px] flex-col overflow-hidden rounded-xl border bg-card shadow-sm"
					>
						{body}
					</aside>
				)
			) : (
				<Sheet open={open} onOpenChange={setOpen}>
					<SheetContent
						side="right"
						className="w-full gap-0 p-0 sm:max-w-md [&>button]:hidden"
					>
						<SheetTitle className="sr-only">AI assistant</SheetTitle>
						{body}
					</SheetContent>
				</Sheet>
			)}

			{!open && (
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={() => setOpen(true)}
							className={cn(
								"fixed right-6 bottom-6 z-40 flex h-12 items-center gap-2 rounded-full pr-5 pl-4",
								"bg-gradient-to-br from-primary to-primary/80 font-medium text-primary-foreground text-sm",
								"shadow-lg shadow-primary/25 transition-transform hover:-translate-y-0.5 hover:shadow-xl",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
							)}
						>
							<Sparkles className="size-4" />
							AI
							{chat.liveReply && (
								<span className="size-2 animate-pulse rounded-full bg-primary-foreground" />
							)}
						</button>
					</TooltipTrigger>
					<TooltipContent side="left">Open the assistant (⌘J)</TooltipContent>
				</Tooltip>
			)}
		</>
	);
}

function PanelBody({
	chat,
	leadSuggestions,
	onClose,
}: {
	chat: AiChatState;
	leadSuggestions: Suggestion[];
	onClose: () => void;
}) {
	const [historyOpen, setHistoryOpen] = useState(false);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<ChatHeader
				chat={chat}
				className="px-3 sm:px-3"
				actions={
					<>
						<Popover open={historyOpen} onOpenChange={setHistoryOpen}>
							<Tooltip>
								<TooltipTrigger asChild>
									<PopoverTrigger asChild>
										<Button
											variant="ghost"
											size="icon-sm"
											aria-label="Conversations"
										>
											<History className="size-4" />
										</Button>
									</PopoverTrigger>
								</TooltipTrigger>
								<TooltipContent>Conversations</TooltipContent>
							</Tooltip>
							<PopoverContent
								align="end"
								className="h-96 w-72 p-0"
								// Picking a conversation focuses the composer; don't take it back
								onCloseAutoFocus={(e) => e.preventDefault()}
							>
								<ConversationList
									activeId={chat.conversationId}
									onSelect={(id) => {
										chat.selectConversation(id);
										setHistoryOpen(false);
									}}
									onNew={() => {
										chat.startNewChat();
										setHistoryOpen(false);
									}}
								/>
							</PopoverContent>
						</Popover>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label="New chat"
									onClick={chat.startNewChat}
								>
									<Plus className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>New chat</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label="Close the assistant"
									onClick={onClose}
								>
									<X className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Close (⌘J)</TooltipContent>
						</Tooltip>
					</>
				}
			/>
			<ChatThread chat={chat} compact leadSuggestions={leadSuggestions} />
		</div>
	);
}
