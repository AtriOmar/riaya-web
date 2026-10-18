"use client";

import { formatDistanceToNow } from "date-fns";
import {
	ArrowUp,
	CalendarCheck,
	Check,
	ChevronDown,
	ChevronUp,
	ClipboardList,
	Copy,
	Crown,
	FileText,
	Loader2,
	type LucideIcon,
	NotebookPen,
	PanelLeft,
	Paperclip,
	Plus,
	Sparkles,
	Square,
	Trash2,
	TriangleAlert,
	UserPlus,
	X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { mutate as mutateSWR } from "swr";
import ConfirmationDialog from "@/components/confirmation-dialog";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { AiChatMessageStatus } from "@/db/schema";
import { getErrorMessage } from "@/lib/error-handling";
import {
	formatTranscriptForAiContext,
	transcriptContextFromRecording,
} from "@/lib/transcript";
import { cn } from "@/lib/utils";
import {
	deleteApiAiChatConversationsId,
	getGetApiAiChatConversationsIdKey,
	postApiAiChatConversationsIdStop,
	useGetApiAiChatConversations,
	useGetApiAiChatConversationsId,
} from "@/services/generated/ai-chat/ai-chat";
import { useGetApiRecordings } from "@/services/generated/recordings/recordings";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "user" | "assistant";
type Message = {
	id: string;
	role: Role;
	content: string;
	status: AiChatMessageStatus;
};

/** The reply is still being written (here or after the page was reopened). */
function isLive(message: Message) {
	return message.status === "streaming" || message.status === "stopping";
}
type TranscriptContext = { recordingId: number; title: string; text: string };

type Suggestion = {
	label: string;
	description: string;
	prompt: string;
	icon: LucideIcon;
};

const CLINICAL_SUGGESTIONS: Suggestion[] = [
	{
		label: "SOAP note template",
		description: "A ready structure for your notes",
		prompt: "Give me a SOAP note template I can use after a consultation.",
		icon: NotebookPen,
	},
	{
		label: "Add a patient",
		description: "Step by step in Riaya",
		prompt: "How do I add a new patient in Riaya?",
		icon: UserPlus,
	},
	{
		label: "Free vs Pro",
		description: "What each plan includes",
		prompt: "What does the Pro plan include compared to Free?",
		icon: Crown,
	},
];

const TRANSCRIPT_SUGGESTIONS: Suggestion[] = [
	{
		label: "Summarize this visit",
		description: "Complaint, findings, assessment, plan",
		prompt:
			"Summarize this consultation: chief complaint, key findings, assessment, and plan.",
		icon: ClipboardList,
	},
	{
		label: "Red flags",
		description: "Urgent concerns to check",
		prompt: "What red flags or urgent concerns stand out in this transcript?",
		icon: TriangleAlert,
	},
	{
		label: "Follow-up plan",
		description: "Next steps and treatment",
		prompt:
			"Draft a concise follow-up and treatment plan based on this consultation.",
		icon: CalendarCheck,
	},
];

// ─── Attach transcript dialog ─────────────────────────────────────────────────

function AttachTranscriptDialog({
	onAttach,
	children,
}: {
	onAttach: (ctx: TranscriptContext) => void;
	children: React.ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const { data: recordings = [], isLoading } = useGetApiRecordings();

	const transcribed = recordings.filter((r) => {
		if (r.transcriptStatus !== "done" || !r.transcript) return false;
		if (!search.trim()) return true;
		const q = search.toLowerCase();
		const title = (r.title ?? "").toLowerCase();
		const patient =
			`${r.patient?.firstName ?? ""} ${r.patient?.lastName ?? ""}`.toLowerCase();
		return title.includes(q) || patient.includes(q);
	});

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) setSearch("");
			}}
		>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="gap-0 p-0 sm:max-w-lg">
				<DialogHeader className="border-b px-5 py-4">
					<DialogTitle>Attach a transcript</DialogTitle>
					<DialogDescription>
						Attach a transcribed recording as context for this conversation.
					</DialogDescription>
				</DialogHeader>
				<div className="border-b p-3">
					<Input
						placeholder="Search by title or patient…"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="h-9"
					/>
				</div>
				<div className="max-h-80 overflow-y-auto p-3">
					{isLoading && (
						<div className="flex justify-center py-10">
							<Loader2 className="size-6 animate-spin text-muted-foreground" />
						</div>
					)}

					{!isLoading && transcribed.length === 0 && (
						<div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-10 text-center">
							<FileText className="size-8 text-muted-foreground" />
							<p className="text-muted-foreground text-sm">
								{search
									? "No matching transcripts."
									: "No transcribed recordings yet. Generate a transcript first."}
							</p>
						</div>
					)}

					{!isLoading && transcribed.length > 0 && (
						<div className="space-y-2">
							{transcribed.map((r) => {
								const patientName =
									r.patient?.firstName || r.patient?.lastName
										? `${r.patient.firstName ?? ""} ${r.patient.lastName ?? ""}`.trim()
										: null;
								return (
									<button
										key={r.id}
										type="button"
										className="w-full rounded-xl border bg-card p-3.5 text-left transition-colors hover:border-primary/30 hover:bg-accent/60"
										onClick={() => {
											onAttach(transcriptContextFromRecording(r));
											setOpen(false);
											setSearch("");
										}}
									>
										<div className="flex items-start gap-3">
											<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
												<FileText className="size-4" />
											</div>
											<div className="min-w-0 flex-1">
												<p className="truncate font-medium text-sm">
													{r.title ?? "Untitled"}
												</p>
												<div className="mt-0.5 flex flex-wrap gap-x-2 text-muted-foreground text-xs">
													{patientName && <span>{patientName}</span>}
													{r.createdAt && (
														<span>
															{new Date(r.createdAt).toLocaleDateString(
																"en-GB",
															)}
														</span>
													)}
												</div>
												{Boolean(r.transcript) && (
													<p className="mt-1.5 line-clamp-2 text-muted-foreground text-xs leading-relaxed">
														{formatTranscriptForAiContext(r.transcript, {
															title: r.title,
															recordedAt: r.createdAt,
															patientName: patientName ?? undefined,
														})}
													</p>
												)}
											</div>
										</div>
									</button>
								);
							})}
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

// ─── Context chip ─────────────────────────────────────────────────────────────

function ContextChip({
	context,
	onRemove,
}: {
	context: TranscriptContext;
	onRemove: () => void;
}) {
	const [expanded, setExpanded] = useState(false);

	return (
		<div className="overflow-hidden rounded-xl border bg-muted/40">
			<div className="flex items-center gap-2 px-3 py-2">
				<div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
					<FileText className="size-3.5" />
				</div>
				<div className="min-w-0 flex-1">
					<p className="truncate font-medium text-sm">{context.title}</p>
					<p className="text-[11px] text-muted-foreground">
						Attached as context
					</p>
				</div>
				<button
					type="button"
					className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
					onClick={() => setExpanded((v) => !v)}
					aria-label={expanded ? "Hide transcript" : "Show transcript"}
				>
					{expanded ? (
						<ChevronUp className="size-4" />
					) : (
						<ChevronDown className="size-4" />
					)}
				</button>
				<button
					type="button"
					className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
					onClick={onRemove}
					aria-label="Remove transcript"
				>
					<X className="size-4" />
				</button>
			</div>
			{expanded && (
				<div className="max-h-36 overflow-y-auto border-t bg-background/60 px-3 py-2">
					<p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
						{typeof context.text === "string"
							? context.text
							: JSON.stringify(context.text, null, 2)}
					</p>
				</div>
			)}
		</div>
	);
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
	if (message.role === "user") {
		return (
			<div className="flex justify-end">
				<div
					dir="auto"
					className="max-w-[min(85%,36rem)] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground text-sm leading-relaxed shadow-sm"
				>
					{message.content}
				</div>
			</div>
		);
	}

	const live = isLive(message);

	return (
		<div className="group flex gap-3">
			<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
				<Sparkles className="size-3.5" />
			</div>

			<div className="min-w-0 flex-1 pt-1">
				{message.content ? (
					<>
						<Streamdown
							dir="auto"
							isAnimating={live}
							caret="block"
							lineNumbers={false}
							controls={{ table: false }}
							tableMaxHeight={480}
							className="chat-markdown"
						>
							{message.content}
						</Streamdown>
					</>
				) : live ? (
					<span className="flex h-6 items-center gap-1 text-muted-foreground">
						<span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.3s]" />
						<span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.15s]" />
						<span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70" />
					</span>
				) : null}
				{!live && (
					<div className="mt-1.5 flex min-h-7 items-center gap-2">
						{message.status === "stopped" && (
							<p className="text-muted-foreground text-xs">
								{message.content ? "Stopped" : "Stopped before answering"}
							</p>
						)}
						{message.status === "failed" && (
							<p className="text-destructive text-xs">
								{message.content
									? "The reply was cut off. Ask again to get the rest."
									: "Something went wrong and no reply was written. Try again."}
							</p>
						)}
						{message.content && <CopyMessageButton text={message.content} />}
					</div>
				)}
			</div>
		</div>
	);
}

function CopyMessageButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			toast.error("Could not copy to clipboard");
		}
	};

	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			className="h-7 gap-1.5 px-2 text-muted-foreground text-xs transition-opacity focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
			onClick={copy}
		>
			{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
			{copied ? "Copied" : "Copy"}
		</Button>
	);
}

// ─── Conversation list sidebar ────────────────────────────────────────────────

function ConversationSidebar({
	activeId,
	onSelect,
	onNew,
}: {
	activeId: number | null;
	onSelect: (id: number) => void;
	onNew: () => void;
}) {
	const {
		data: conversations = [],
		isLoading,
		mutate,
	} = useGetApiAiChatConversations();
	const [deleteId, setDeleteId] = useState<number | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	const confirmDelete = async () => {
		if (!deleteId) return;
		setIsDeleting(true);
		try {
			await deleteApiAiChatConversationsId(String(deleteId));
			toast.success("Conversation deleted");
			if (activeId === deleteId) onNew();
			setDeleteId(null);
			mutate();
		} catch (err) {
			toast.error(getErrorMessage(err, "Failed to delete conversation"));
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<div className="flex h-full w-full flex-col">
			<div className="shrink-0 p-3">
				<Button
					variant="outline"
					className="h-10 w-full justify-start gap-2 rounded-xl bg-background shadow-xs"
					onClick={onNew}
				>
					<Plus className="size-4" />
					New chat
				</Button>
			</div>

			<p className="px-5 pb-1.5 font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
				Recent
			</p>

			<div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
				{isLoading && (
					<div className="flex justify-center py-10">
						<Loader2 className="size-5 animate-spin text-muted-foreground" />
					</div>
				)}

				{!isLoading && conversations.length === 0 && (
					<p className="px-3 py-6 text-center text-muted-foreground text-xs leading-relaxed">
						Your conversations will show up here.
					</p>
				)}

				{!isLoading &&
					conversations.map((c) => {
						const isActive = activeId === c.id;
						return (
							<div
								key={c.id}
								className={cn(
									"group relative flex items-center rounded-lg transition-colors",
									isActive
										? "bg-background shadow-xs ring-1 ring-border"
										: "hover:bg-background/70",
								)}
							>
								<button
									type="button"
									className="min-w-0 flex-1 py-2 pr-9 pl-3 text-left"
									onClick={() => onSelect(c.id)}
								>
									<p
										className={cn(
											"truncate text-sm",
											isActive ? "font-medium" : "text-foreground/90",
										)}
									>
										{c.title ?? "Untitled"}
									</p>
									{c.updatedAt && (
										<p className="mt-0.5 text-[11px] text-muted-foreground">
											{formatDistanceToNow(new Date(c.updatedAt), {
												addSuffix: true,
											})}
										</p>
									)}
								</button>
								<button
									type="button"
									className="absolute right-1.5 rounded-md p-1.5 text-muted-foreground opacity-70 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
									onClick={(e) => {
										e.stopPropagation();
										setDeleteId(c.id);
									}}
									aria-label="Delete conversation"
								>
									<Trash2 className="size-3.5" />
								</button>
							</div>
						);
					})}
			</div>

			<ConfirmationDialog
				open={deleteId !== null}
				onOpenChange={(open) => {
					if (!open) setDeleteId(null);
				}}
				title="Delete conversation?"
				description="This permanently removes the conversation and all its messages."
				variant="destructive"
				confirmText="Delete"
				onConfirm={confirmDelete}
				isLoading={isDeleting}
			/>
		</div>
	);
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AiChat() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const preloadRecordingId = searchParams.get("transcript");

	const [conversationId, setConversationId] = useState<number | null>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [isStreaming, setIsStreaming] = useState(false);
	const [transcriptContext, setTranscriptContext] =
		useState<TranscriptContext | null>(null);
	const [showMobileList, setShowMobileList] = useState(false);

	const scrollRef = useRef<HTMLDivElement>(null);
	const stickToBottomRef = useRef(true);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const abortRef = useRef<AbortController | null>(null);
	/** Prevents URL `?transcript=` from re-attaching after the user removes it. */
	const didPreloadFromUrlRef = useRef(false);
	/** Conversation whose recording context was already applied (so streaming end won't re-attach). */
	const contextSyncedForConversationRef = useRef<number | null>(null);
	/** User explicitly removed context — do not re-apply from URL or conversation.recording. */
	const userDismissedContextRef = useRef(false);
	/** Which conversation id local `messages` were last synced from the server for. */
	const messagesSyncedForConversationRef = useRef<number | null>(null);

	const { data: recordings = [] } = useGetApiRecordings();
	const {
		data: conversationDetail,
		isLoading: isLoadingConversation,
		mutate: mutateConversationDetail,
	} = useGetApiAiChatConversationsId(
		conversationId ? String(conversationId) : "",
		{
			swr: {
				enabled: !!conversationId,
				// Follow a reply that is being written without this tab streaming it
				// (the page was reopened, or another conversation was open meanwhile).
				refreshInterval: isStreaming
					? 0
					: (data) =>
							data?.messages.some(
								(m) => m.status === "streaming" || m.status === "stopping",
							)
								? 1000
								: 0,
			},
		},
	);
	const { mutate: mutateConversationList } = useGetApiAiChatConversations();

	const syncTextareaHeight = useCallback(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = "0px";
		el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
	}, []);

	const focusComposer = useCallback(() => {
		requestAnimationFrame(() => {
			textareaRef.current?.focus();
		});
	}, []);

	useEffect(() => {
		syncTextareaHeight();
	}, [input, syncTextareaHeight]);

	useEffect(() => {
		textareaRef.current?.focus();
	}, []);

	// Auto-load transcript from URL query param once (for a new chat)
	useEffect(() => {
		if (!preloadRecordingId || !recordings.length || conversationId) return;
		if (didPreloadFromUrlRef.current || userDismissedContextRef.current) return;
		const found = recordings.find(
			(r) =>
				r.id === Number(preloadRecordingId) &&
				r.transcriptStatus === "done" &&
				r.transcript,
		);
		if (found) {
			didPreloadFromUrlRef.current = true;
			setTranscriptContext(transcriptContextFromRecording(found));
		}
	}, [preloadRecordingId, recordings, conversationId]);

	// Load messages when selecting an existing conversation.
	// Recording context is synced only when switching conversations — not when
	// streaming ends — so Remove context stays removed.
	useEffect(() => {
		if (!conversationDetail || !conversationId) return;
		if (isStreaming) return;

		const serverMessages = conversationDetail.messages ?? [];
		const switchedConversation =
			messagesSyncedForConversationRef.current !== conversationId;

		setMessages((prev) => {
			if (!switchedConversation && serverMessages.length < prev.length) {
				return prev;
			}
			return serverMessages.map((m) => ({
				id: String(m.id),
				role: m.role as Role,
				content: m.content,
				status: m.status,
			}));
		});
		messagesSyncedForConversationRef.current = conversationId;

		if (contextSyncedForConversationRef.current === conversationId) return;
		contextSyncedForConversationRef.current = conversationId;

		if (userDismissedContextRef.current) {
			setTranscriptContext(null);
			return;
		}

		if (conversationDetail.recording?.transcript) {
			setTranscriptContext(
				transcriptContextFromRecording({
					id: conversationDetail.recording.id,
					title: conversationDetail.recording.title,
					transcript: conversationDetail.recording.transcript,
				}),
			);
		} else {
			setTranscriptContext(null);
		}
	}, [conversationDetail, conversationId, isStreaming]);

	// If the user dismissed context before the conversation id existed, unlink once it does.
	useEffect(() => {
		if (!conversationId || !userDismissedContextRef.current) return;
		void fetch(`/api/ai-chat/conversations/${conversationId}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ recordingId: null }),
		}).then(() => mutateConversationDetail());
	}, [conversationId, mutateConversationDetail]);

	// Follow new content only while the user is at the bottom, so scrolling up
	// to reread an answer isn't hijacked by the stream.
	const handleScroll = useCallback(() => {
		const el = scrollRef.current;
		if (!el) return;
		stickToBottomRef.current =
			el.scrollHeight - el.scrollTop - el.clientHeight < 80;
	}, []);

	useEffect(() => {
		if (!messages.length) return;
		const el = scrollRef.current;
		if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
	}, [messages]);

	const attachTranscript = useCallback((ctx: TranscriptContext) => {
		userDismissedContextRef.current = false;
		setTranscriptContext(ctx);
		textareaRef.current?.focus();
	}, []);

	const removeTranscriptContext = useCallback(async () => {
		userDismissedContextRef.current = true;
		didPreloadFromUrlRef.current = true;
		setTranscriptContext(null);
		if (conversationId) {
			contextSyncedForConversationRef.current = conversationId;
		}

		if (preloadRecordingId) {
			router.replace("/dashboard/ai-chat");
		}

		if (conversationId) {
			try {
				await fetch(`/api/ai-chat/conversations/${conversationId}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ recordingId: null }),
				});
				await mutateConversationDetail();
			} catch {
				// Context is already cleared locally; unlink failure is non-blocking
			}
		}
	}, [conversationId, preloadRecordingId, router, mutateConversationDetail]);

	const startNewChat = useCallback(() => {
		if (abortRef.current) abortRef.current.abort();
		setConversationId(null);
		setMessages([]);
		setIsStreaming(false);
		setShowMobileList(false);
		contextSyncedForConversationRef.current = null;
		messagesSyncedForConversationRef.current = null;
		// Keep context only while `?transcript=` is still present (user hasn't removed it).
		if (!preloadRecordingId) {
			didPreloadFromUrlRef.current = false;
			userDismissedContextRef.current = false;
			setTranscriptContext(null);
		}
	}, [preloadRecordingId]);

	const selectConversation = useCallback((id: number) => {
		if (abortRef.current) abortRef.current.abort();
		setIsStreaming(false);
		userDismissedContextRef.current = false;
		contextSyncedForConversationRef.current = null;
		messagesSyncedForConversationRef.current = null;
		stickToBottomRef.current = true;
		setConversationId(id);
		setShowMobileList(false);
	}, []);

	// Stop is done on the server, so it also works for a reply this tab isn't
	// streaming. A streaming tab keeps reading: the server ends the stream once
	// it has saved the final text, so what is saved is what was shown.
	const stopReply = useCallback(async () => {
		if (!conversationId) return;
		setMessages((prev) =>
			prev.map((m) =>
				m.status === "streaming" ? { ...m, status: "stopping" } : m,
			),
		);
		try {
			await postApiAiChatConversationsIdStop(String(conversationId));
			if (!isStreaming) await mutateConversationDetail();
		} catch (err) {
			toast.error(getErrorMessage(err, "Could not stop the reply"));
		}
	}, [conversationId, isStreaming, mutateConversationDetail]);

	const sendMessage = useCallback(
		async (override?: string) => {
			const text = (override ?? input).trim();
			if (!text || isStreaming || messages.some(isLive)) return;

			const userMessage: Message = {
				id: crypto.randomUUID(),
				role: "user",
				content: text,
				status: "done",
			};
			const assistantMessage: Message = {
				id: crypto.randomUUID(),
				role: "assistant",
				content: "",
				status: "streaming",
			};

			stickToBottomRef.current = true;
			setMessages((prev) => [...prev, userMessage, assistantMessage]);
			setInput("");
			setIsStreaming(true);
			focusComposer();

			const allMessages: Message[] = [...messages, userMessage];

			abortRef.current = new AbortController();
			let resolvedConversationId = conversationId;
			/** Once true, the server saved the turn; errors after it are on the reply. */
			let replyStarted = false;
			try {
				const res = await fetch("/api/ai-chat", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						messages: allMessages.map(({ role, content }) => ({
							role,
							content,
						})),
						conversationId: conversationId ?? undefined,
						recordingId: transcriptContext?.recordingId,
						transcriptContext: transcriptContext?.text,
					}),
					signal: abortRef.current.signal,
				});

				if (!res.ok) {
					const errData = await res.json().catch(() => ({}));
					throw Object.assign(new Error("Request failed"), {
						error: errData?.error,
					});
				}

				const newConversationId = res.headers.get("X-Conversation-Id");
				if (newConversationId) {
					const id = Number(newConversationId);
					if (!Number.isNaN(id)) {
						resolvedConversationId = id;
						if (id !== conversationId) {
							setConversationId(id);
						}
					}
				}

				replyStarted = true;
				if (!res.body) throw new Error("No response body");

				const reader = res.body.getReader();
				const decoder = new TextDecoder();
				let done = false;

				while (!done) {
					const { value, done: doneReading } = await reader.read();
					done = doneReading;
					if (value) {
						const chunk = decoder.decode(value, { stream: true });
						if (!chunk) continue;
						setMessages((prev) =>
							prev.map((m) =>
								m.id === assistantMessage.id
									? { ...m, content: m.content + chunk }
									: m,
							),
						);
					}
				}

				await mutateConversationList();
				if (resolvedConversationId) {
					await mutateSWR(
						getGetApiAiChatConversationsIdKey(String(resolvedConversationId)),
					);
				}
			} catch (err: unknown) {
				// Leaving the conversation aborts this tab's copy; the reply goes on.
				if (err instanceof Error && err.name === "AbortError") return;
				if (replyStarted && resolvedConversationId) {
					// The server marked the reply failed; show what it saved.
					await mutateSWR(
						getGetApiAiChatConversationsIdKey(String(resolvedConversationId)),
					);
					return;
				}
				toast.error(getErrorMessage(err, "Failed to get response from AI"));
				setMessages((prev) =>
					prev.filter(
						(m) => m.id !== assistantMessage.id && m.id !== userMessage.id,
					),
				);
			} finally {
				setIsStreaming(false);
				abortRef.current = null;
				focusComposer();
			}
		},
		[
			input,
			isStreaming,
			messages,
			transcriptContext,
			conversationId,
			mutateConversationList,
			focusComposer,
		],
	);

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	};

	const headerTitle =
		conversationDetail?.title ??
		(conversationId ? "Conversation" : "New conversation");
	const suggestions = transcriptContext
		? TRANSCRIPT_SUGGESTIONS
		: CLINICAL_SUGGESTIONS;
	const liveReply = messages.find(isLive);
	const canSend = Boolean(input.trim()) && !isStreaming && !liveReply;

	return (
		<div className="flex h-[calc(100dvh-9rem)] overflow-hidden rounded-2xl border bg-card shadow-sm">
			<aside className="hidden h-full w-64 shrink-0 border-r bg-muted/40 md:flex lg:w-72">
				<ConversationSidebar
					activeId={conversationId}
					onSelect={selectConversation}
					onNew={startNewChat}
				/>
			</aside>

			<Sheet open={showMobileList} onOpenChange={setShowMobileList}>
				<SheetContent side="left" className="w-80 gap-0 p-0 sm:max-w-80">
					<SheetTitle className="sr-only">Conversations</SheetTitle>
					<ConversationSidebar
						activeId={conversationId}
						onSelect={selectConversation}
						onNew={startNewChat}
					/>
				</SheetContent>
			</Sheet>

			<div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
				<header className="flex h-16 shrink-0 items-center gap-3 border-b px-3 sm:px-5">
					<Button
						variant="ghost"
						size="icon-sm"
						className="-ml-1 md:hidden"
						onClick={() => setShowMobileList(true)}
						aria-label="Open conversations"
					>
						<PanelLeft className="size-4" />
					</Button>
					<div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
						<Sparkles className="size-4" />
					</div>
					<div className="min-w-0">
						<p className="truncate font-semibold text-sm">{headerTitle}</p>
						<p className="flex items-center gap-1.5 text-muted-foreground text-xs">
							{liveReply ? (
								<>
									<span className="size-1.5 animate-pulse rounded-full bg-primary" />
									{liveReply.status === "stopping"
										? "Stopping…"
										: "Responding…"}
								</>
							) : (
								"Riaya AI assistant"
							)}
						</p>
					</div>
				</header>

				{/* Messages */}
				<div
					ref={scrollRef}
					onScroll={handleScroll}
					className="min-h-0 flex-1 overflow-y-auto"
				>
					{isLoadingConversation && conversationId ? (
						<div className="flex h-full items-center justify-center">
							<Loader2 className="size-6 animate-spin text-muted-foreground" />
						</div>
					) : messages.length === 0 ? (
						<div className="flex min-h-full flex-col items-center justify-center gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-10">
							<div className="flex flex-col items-center text-center">
								<div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/20">
									<Sparkles className="size-6" />
								</div>
								<h2 className="mt-5 font-semibold text-2xl tracking-tight">
									How can I help today?
								</h2>
								<p className="mt-2 max-w-md text-muted-foreground text-sm leading-relaxed">
									{transcriptContext
										? "Ask anything about the attached transcript."
										: "Ask about consultations, symptoms, or how to use Riaya."}
								</p>
							</div>
							<div className="grid w-full max-w-2xl gap-2.5 sm:grid-cols-3">
								{suggestions.map((item) => (
									<button
										key={item.label}
										type="button"
										className="group flex items-center gap-3 rounded-xl border bg-background p-3 sm:flex-col sm:items-start sm:p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
										onClick={() => sendMessage(item.prompt)}
									>
										<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
											<item.icon className="size-4" />
										</span>
										<span>
											<span className="block font-medium text-sm">
												{item.label}
											</span>
											<span className="mt-0.5 block text-muted-foreground text-xs">
												{item.description}
											</span>
										</span>
									</button>
								))}
							</div>
						</div>
					) : (
						<div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
							{messages.map((msg) => (
								<MessageBubble key={msg.id} message={msg} />
							))}
						</div>
					)}
				</div>

				{/* Composer */}
				<div className="shrink-0 bg-gradient-to-t from-card via-card to-card/80 px-3 pb-3 pt-1 sm:px-4">
					<div className="mx-auto w-full max-w-3xl space-y-2">
						{transcriptContext && (
							<ContextChip
								context={transcriptContext}
								onRemove={() => {
									void removeTranscriptContext();
								}}
							/>
						)}

						<div
							className={cn(
								"rounded-2xl border bg-background shadow-sm transition-[box-shadow,border-color]",
								"focus-within:border-primary/40 focus-within:shadow-md focus-within:ring-2 focus-within:ring-primary/10",
							)}
						>
							<Textarea
								ref={textareaRef}
								value={input}
								onChange={(e) => setInput(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder="Ask anything, or attach a transcript…"
								className="max-h-40 min-h-12 field-sizing-fixed resize-none border-0 bg-transparent px-4 py-3 shadow-none focus-visible:border-transparent focus-visible:ring-0 disabled:bg-transparent dark:bg-transparent dark:disabled:bg-transparent"
								rows={1}
							/>
							<div className="flex items-center justify-between gap-2 px-2 pb-2">
								<AttachTranscriptDialog onAttach={attachTranscript}>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className={cn(
											"h-8 gap-1.5 rounded-full px-2.5 text-muted-foreground",
											transcriptContext &&
												"bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
										)}
										disabled={Boolean(liveReply)}
										aria-label={
											transcriptContext
												? "Replace attached transcript"
												: "Attach transcript"
										}
									>
										<Paperclip className="size-4" />
										<span className="hidden sm:inline">
											{transcriptContext ? "Replace" : "Attach"}
										</span>
									</Button>
								</AttachTranscriptDialog>

								<Button
									type="button"
									size="icon"
									className="size-9 rounded-full"
									onMouseDown={(e) => e.preventDefault()}
									onClick={liveReply ? stopReply : () => sendMessage()}
									disabled={
										liveReply ? liveReply.status === "stopping" : !canSend
									}
									aria-label={liveReply ? "Stop generating" : "Send message"}
								>
									{liveReply?.status === "stopping" ? (
										<Loader2 className="size-4 animate-spin" />
									) : liveReply ? (
										<Square className="size-3.5 fill-current" />
									) : (
										<ArrowUp className="size-4" />
									)}
								</Button>
							</div>
						</div>
						<p className="text-center text-[11px] text-muted-foreground">
							Responses may contain inaccuracies — always apply clinical
							judgment
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
