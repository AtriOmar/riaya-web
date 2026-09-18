"use client";

import { formatDistanceToNow } from "date-fns";
import {
	Bot,
	ChevronDown,
	ChevronUp,
	FileText,
	Loader2,
	MessageSquare,
	PanelLeft,
	Paperclip,
	Plus,
	Send,
	Sparkles,
	Square,
	Trash2,
	User,
	X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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
import { getErrorMessage } from "@/lib/error-handling";
import { cn } from "@/lib/utils";
import {
	deleteApiAiChatConversationsId,
	useGetApiAiChatConversations,
	useGetApiAiChatConversationsId,
} from "@/services/generated/ai-chat/ai-chat";
import { useGetApiRecordings } from "@/services/generated/recordings/recordings";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "user" | "assistant";
type Message = { id: string; role: Role; content: string };
type TranscriptContext = { recordingId: number; title: string; text: string };

const CLINICAL_SUGGESTIONS = [
	{
		label: "SOAP note template",
		prompt: "Give me a SOAP note template I can use after a consultation.",
	},
	{
		label: "Add a patient",
		prompt: "How do I add a new patient in Riaya?",
	},
	{
		label: "Free vs Pro",
		prompt: "What does the Pro plan include compared to Free?",
	},
] as const;

const TRANSCRIPT_SUGGESTIONS = [
	{
		label: "Summarize this visit",
		prompt:
			"Summarize this consultation: chief complaint, key findings, assessment, and plan.",
	},
	{
		label: "Red flags",
		prompt: "What red flags or urgent concerns stand out in this transcript?",
	},
	{
		label: "Follow-up plan",
		prompt:
			"Draft a concise follow-up and treatment plan based on this consultation.",
	},
] as const;

// ─── Transcript import dialog ─────────────────────────────────────────────────

function ImportTranscriptDialog({
	onImport,
	children,
}: {
	onImport: (ctx: TranscriptContext) => void;
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
					<DialogTitle>Import a transcript</DialogTitle>
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
											onImport({
												recordingId: r.id,
												title: r.title ?? "Untitled",
												text:
													typeof r.transcript === "string"
														? r.transcript
														: JSON.stringify(r.transcript, null, 2),
											});
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
														{typeof r.transcript === "string"
															? r.transcript
															: JSON.stringify(r.transcript)}
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

function MessageBubble({
	message,
	isStreaming,
}: {
	message: Message;
	isStreaming?: boolean;
}) {
	const isUser = message.role === "user";
	const showCursor = Boolean(isStreaming && !isUser && message.content);

	return (
		<div
			className={cn(
				"flex items-end gap-2.5",
				isUser ? "flex-row-reverse" : "flex-row",
			)}
		>
			<div
				className={cn(
					"mb-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
					isUser
						? "bg-primary text-primary-foreground"
						: "bg-muted text-muted-foreground",
				)}
			>
				{isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
			</div>

			<div
				className={cn(
					"max-w-[min(100%,36rem)] text-sm leading-relaxed",
					isUser
						? "rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground shadow-sm"
						: "rounded-2xl rounded-bl-md bg-muted/70 px-4 py-2.5",
				)}
			>
				{message.content ? (
					<span className="whitespace-pre-wrap">
						{message.content}
						{showCursor && (
							<span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current align-middle opacity-70" />
						)}
					</span>
				) : (
					<span className="flex items-center gap-1 py-0.5 text-muted-foreground">
						<span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.3s]" />
						<span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.15s]" />
						<span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70" />
					</span>
				)}
			</div>
		</div>
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
		<div className="flex h-full w-full flex-col bg-muted/30 md:w-72 md:shrink-0 md:border-r">
			<div className="flex items-center justify-between gap-2 px-3 py-3">
				<p className="font-semibold text-sm">Conversations</p>
				<Button
					size="sm"
					variant="ghost"
					className="h-8 gap-1 px-2"
					onClick={onNew}
				>
					<Plus className="size-3.5" />
					New
				</Button>
			</div>

			<div className="flex-1 overflow-y-auto px-2 pb-3">
				{isLoading && (
					<div className="flex justify-center py-10">
						<Loader2 className="size-5 animate-spin text-muted-foreground" />
					</div>
				)}

				{!isLoading && conversations.length === 0 && (
					<div className="mx-1 rounded-xl border border-dashed px-3 py-8 text-center text-muted-foreground text-xs leading-relaxed">
						No conversations yet. Send a message to start one.
					</div>
				)}

				{!isLoading &&
					conversations.map((c) => (
						<div
							key={c.id}
							className={cn(
								"group mb-1 flex items-start gap-0.5 rounded-xl transition-colors",
								activeId === c.id
									? "bg-background shadow-sm ring-1 ring-border"
									: "hover:bg-background/70",
							)}
						>
							<button
								type="button"
								className="min-w-0 flex-1 px-3 py-2.5 text-left"
								onClick={() => onSelect(c.id)}
							>
								<div className="flex items-center gap-2">
									<MessageSquare
										className={cn(
											"size-3.5 shrink-0",
											activeId === c.id
												? "text-primary"
												: "text-muted-foreground",
										)}
									/>
									<p className="truncate font-medium text-sm">
										{c.title ?? "Untitled"}
									</p>
								</div>
								{c.preview && (
									<p className="mt-0.5 line-clamp-1 pl-6 text-muted-foreground text-xs">
										{c.preview}
									</p>
								)}
								{c.updatedAt && (
									<p className="mt-0.5 pl-6 text-[11px] text-muted-foreground/70">
										{formatDistanceToNow(new Date(c.updatedAt), {
											addSuffix: true,
										})}
									</p>
								)}
							</button>
							<button
								type="button"
								className="mr-1.5 mt-2 rounded-md p-1.5 text-muted-foreground opacity-70 transition-opacity hover:bg-destructive/10 hover:text-destructive md:opacity-0 md:group-hover:opacity-100"
								onClick={(e) => {
									e.stopPropagation();
									setDeleteId(c.id);
								}}
								aria-label="Delete conversation"
							>
								<Trash2 className="size-3.5" />
							</button>
						</div>
					))}
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
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const abortRef = useRef<AbortController | null>(null);
	/** Prevents URL `?transcript=` from re-attaching after the user removes it. */
	const didPreloadFromUrlRef = useRef(false);
	/** Conversation whose recording context was already applied (so streaming end won't re-attach). */
	const contextSyncedForConversationRef = useRef<number | null>(null);
	/** User explicitly removed context — do not re-apply from URL or conversation.recording. */
	const userDismissedContextRef = useRef(false);

	const { data: recordings = [] } = useGetApiRecordings();
	const {
		data: conversationDetail,
		isLoading: isLoadingConversation,
		mutate: mutateConversationDetail,
	} = useGetApiAiChatConversationsId(
		conversationId ? String(conversationId) : "",
		{ swr: { enabled: !!conversationId } },
	);
	const { mutate: mutateConversationList } = useGetApiAiChatConversations();

	const syncTextareaHeight = useCallback(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = "0px";
		el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
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
			setTranscriptContext({
				recordingId: found.id,
				title: found.title ?? "Untitled",
				text:
					typeof found.transcript === "string"
						? found.transcript
						: JSON.stringify(found.transcript, null, 2),
			});
		}
	}, [preloadRecordingId, recordings, conversationId]);

	// Load messages when selecting an existing conversation.
	// Recording context is synced only when switching conversations — not when
	// streaming ends — so Remove context stays removed.
	useEffect(() => {
		if (!conversationDetail || !conversationId) return;
		if (isStreaming) return;

		setMessages(
			(conversationDetail.messages ?? []).map((m) => ({
				id: String(m.id),
				role: m.role as Role,
				content: m.content,
			})),
		);

		if (contextSyncedForConversationRef.current === conversationId) return;
		contextSyncedForConversationRef.current = conversationId;

		if (userDismissedContextRef.current) {
			setTranscriptContext(null);
			return;
		}

		if (conversationDetail.recording?.transcript) {
			setTranscriptContext({
				recordingId: conversationDetail.recording.id,
				title: conversationDetail.recording.title ?? "Untitled",
				text:
					typeof conversationDetail.recording.transcript === "string"
						? conversationDetail.recording.transcript
						: JSON.stringify(conversationDetail.recording.transcript, null, 2),
			});
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

	// Auto-scroll to bottom
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [messages]);

	const importTranscript = useCallback((ctx: TranscriptContext) => {
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
		setConversationId(id);
		setShowMobileList(false);
	}, []);

	const stopStreaming = useCallback(() => {
		abortRef.current?.abort();
	}, []);

	const sendMessage = useCallback(async () => {
		const text = input.trim();
		if (!text || isStreaming) return;

		const userMessage: Message = {
			id: crypto.randomUUID(),
			role: "user",
			content: text,
		};
		const assistantMessage: Message = {
			id: crypto.randomUUID(),
			role: "assistant",
			content: "",
		};

		setMessages((prev) => [...prev, userMessage, assistantMessage]);
		setInput("");
		setIsStreaming(true);

		const allMessages: Message[] = [...messages, userMessage];

		abortRef.current = new AbortController();
		try {
			const res = await fetch("/api/ai-chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					messages: allMessages.map(({ role, content }) => ({ role, content })),
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
				if (!Number.isNaN(id) && id !== conversationId) {
					setConversationId(id);
				}
			}

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

			mutateConversationList();
		} catch (err: unknown) {
			if (err instanceof Error && err.name === "AbortError") return;
			toast.error(getErrorMessage(err, "Failed to get response from AI"));
			setMessages((prev) =>
				prev.filter(
					(m) => m.id !== assistantMessage.id && m.id !== userMessage.id,
				),
			);
		} finally {
			setIsStreaming(false);
			abortRef.current = null;
		}
	}, [
		input,
		isStreaming,
		messages,
		transcriptContext,
		conversationId,
		mutateConversationList,
	]);

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	};

	const applySuggestion = (prompt: string) => {
		setInput(prompt);
		requestAnimationFrame(() => textareaRef.current?.focus());
	};

	const headerTitle =
		conversationDetail?.title ??
		(conversationId ? "Conversation" : "New conversation");
	const suggestions = transcriptContext
		? TRANSCRIPT_SUGGESTIONS
		: CLINICAL_SUGGESTIONS;
	const canSend = Boolean(input.trim()) && !isStreaming;

	return (
		<div className="flex h-[calc(100dvh-9rem)] overflow-hidden rounded-2xl border bg-card shadow-sm">
			{/* Desktop sidebar */}
			<div className="hidden md:flex">
				<ConversationSidebar
					activeId={conversationId}
					onSelect={selectConversation}
					onNew={startNewChat}
				/>
			</div>

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

			{/* Chat pane */}
			<div className="relative flex min-w-0 flex-1 flex-col">
				<header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-3">
					<div className="flex min-w-0 items-center gap-1">
						<Button
							variant="ghost"
							size="icon-sm"
							className="md:hidden"
							onClick={() => setShowMobileList(true)}
							aria-label="Open conversations"
						>
							<PanelLeft className="size-4" />
						</Button>
						<div className="min-w-0">
							<p className="truncate font-medium text-sm">{headerTitle}</p>
							{isStreaming && (
								<p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
									<span className="size-1.5 animate-pulse rounded-full bg-primary" />
									Responding…
								</p>
							)}
						</div>
					</div>
					<Button
						variant="ghost"
						size="sm"
						className="gap-1.5 text-muted-foreground"
						onClick={startNewChat}
					>
						<Plus className="size-4" />
						<span className="hidden sm:inline">New chat</span>
					</Button>
				</header>

				{/* Messages */}
				<div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
					{isLoadingConversation && conversationId ? (
						<div className="flex h-full items-center justify-center">
							<Loader2 className="size-6 animate-spin text-muted-foreground" />
						</div>
					) : messages.length === 0 ? (
						<div className="flex h-full flex-col items-center justify-center gap-6 px-6 py-10">
							<div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 shadow-inner">
								<Sparkles className="size-7 text-primary" />
							</div>
							<div className="max-w-md text-center">
								<p className="font-semibold text-xl tracking-tight">
									How can I help today?
								</p>
								<p className="mt-2 text-muted-foreground text-sm leading-relaxed">
									Ask about consultations, symptoms, or how to use Riaya. Attach
									a transcript from the composer below.
								</p>
							</div>
							<div className="grid w-full max-w-xl gap-2 sm:grid-cols-3">
								{suggestions.map((item) => (
									<button
										key={item.label}
										type="button"
										className="rounded-xl border bg-background px-3.5 py-3 text-left text-sm shadow-sm transition-colors hover:border-primary/30 hover:bg-accent/50"
										onClick={() => applySuggestion(item.prompt)}
									>
										<span className="font-medium">{item.label}</span>
									</button>
								))}
							</div>
						</div>
					) : (
						<div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6">
							{messages.map((msg, index) => (
								<MessageBubble
									key={msg.id}
									message={msg}
									isStreaming={
										isStreaming &&
										index === messages.length - 1 &&
										msg.role === "assistant"
									}
								/>
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
								disabled={isStreaming}
								rows={1}
							/>
							<div className="flex items-center justify-between gap-2 px-2 pb-2">
								<ImportTranscriptDialog onImport={importTranscript}>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className={cn(
											"h-8 gap-1.5 rounded-full px-2.5 text-muted-foreground",
											transcriptContext &&
												"bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
										)}
										disabled={isStreaming}
										aria-label={
											transcriptContext
												? "Replace transcript"
												: "Import transcript"
										}
									>
										<Paperclip className="size-4" />
										<span className="hidden sm:inline">
											{transcriptContext ? "Replace" : "Import"}
										</span>
									</Button>
								</ImportTranscriptDialog>

								<Button
									type="button"
									size="icon"
									className="size-9 rounded-full"
									onClick={isStreaming ? stopStreaming : sendMessage}
									disabled={!isStreaming && !canSend}
									aria-label={isStreaming ? "Stop generating" : "Send message"}
								>
									{isStreaming ? (
										<Square className="size-3.5 fill-current" />
									) : (
										<Send className="size-3.5" />
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
