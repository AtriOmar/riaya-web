"use client";

import {
	Bot,
	ChevronDown,
	ChevronUp,
	FileText,
	Loader2,
	MessageSquare,
	Plus,
	Send,
	Trash2,
	User,
	X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import ConfirmationDialog from "@/components/confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
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

// ─── Transcript import dialog ─────────────────────────────────────────────────

function ImportTranscriptDialog({
	onImport,
}: {
	onImport: (ctx: TranscriptContext) => void;
}) {
	const [open, setOpen] = useState(false);
	const { data: recordings = [], isLoading } = useGetApiRecordings();

	const transcribed = recordings.filter(
		(r) => r.transcriptStatus === "done" && r.transcript,
	);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm" className="gap-2">
					<FileText className="size-4" />
					Import Transcript
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Import a Transcript</DialogTitle>
				</DialogHeader>
				<p className="text-muted-foreground text-sm">
					Select a transcribed recording to use as context for this
					conversation.
				</p>

				{isLoading && (
					<div className="flex justify-center py-6">
						<Loader2 className="size-6 animate-spin text-muted-foreground" />
					</div>
				)}

				{!isLoading && transcribed.length === 0 && (
					<div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-8 text-center">
						<FileText className="size-8 text-muted-foreground" />
						<p className="text-muted-foreground text-sm">
							No transcribed recordings yet. Go to Recordings and generate a
							transcript first.
						</p>
					</div>
				)}

				{!isLoading && transcribed.length > 0 && (
					<div className="max-h-72 space-y-2 overflow-y-auto">
						{transcribed.map((r) => {
							const patientName =
								r.patient?.firstName || r.patient?.lastName
									? `${r.patient.firstName ?? ""} ${r.patient.lastName ?? ""}`.trim()
									: null;
							return (
								<button
									key={r.id}
									type="button"
									className="w-full rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent"
									onClick={() => {
										onImport({
											recordingId: r.id,
											title: r.title ?? "Untitled",
											text: r.transcript ?? "",
										});
										setOpen(false);
									}}
								>
									<p className="font-medium text-sm">{r.title ?? "Untitled"}</p>
									<div className="mt-1 flex flex-wrap gap-2 text-muted-foreground text-xs">
										{patientName && <span>{patientName}</span>}
										{r.createdAt && (
											<span>
												{new Date(r.createdAt).toLocaleDateString("en-GB")}
											</span>
										)}
									</div>
									{r.transcript && (
										<p className="mt-1.5 line-clamp-2 text-muted-foreground text-xs">
											{r.transcript}
										</p>
									)}
								</button>
							);
						})}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}

// ─── Context card ─────────────────────────────────────────────────────────────

function ContextCard({
	context,
	onRemove,
}: {
	context: TranscriptContext;
	onRemove: () => void;
}) {
	const [expanded, setExpanded] = useState(false);

	return (
		<div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-800/40 dark:bg-blue-900/15">
			<div className="flex items-start justify-between gap-2">
				<div className="flex min-w-0 items-center gap-2">
					<FileText className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
					<div className="min-w-0">
						<p className="truncate font-medium text-blue-900 text-sm dark:text-blue-100">
							Context: {context.title}
						</p>
						<p className="text-blue-600 text-xs dark:text-blue-400">
							Transcript is included in every message
						</p>
					</div>
				</div>
				<div className="flex shrink-0 gap-1">
					<button
						type="button"
						className="rounded p-1 text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-800/30"
						onClick={() => setExpanded((v) => !v)}
						aria-label={expanded ? "Collapse" : "Expand"}
					>
						{expanded ? (
							<ChevronUp className="size-4" />
						) : (
							<ChevronDown className="size-4" />
						)}
					</button>
					<button
						type="button"
						className="rounded p-1 text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-800/30"
						onClick={onRemove}
						aria-label="Remove context"
					>
						<X className="size-4" />
					</button>
				</div>
			</div>
			{expanded && (
				<div className="mt-2 max-h-40 overflow-y-auto rounded bg-white/60 p-2 dark:bg-blue-950/30">
					<p className="whitespace-pre-wrap text-xs leading-relaxed">
						{context.text}
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
	const showCursor = Boolean(isStreaming && !isUser);
	return (
		<div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
			<div
				className={cn(
					"flex size-8 shrink-0 items-center justify-center rounded-full",
					isUser
						? "bg-primary text-primary-foreground"
						: "bg-muted text-muted-foreground",
				)}
			>
				{isUser ? <User className="size-4" /> : <Bot className="size-4" />}
			</div>

			<div
				className={cn(
					"max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
					isUser
						? "rounded-tr-sm bg-primary text-primary-foreground"
						: "rounded-tl-sm bg-muted",
				)}
			>
				{message.content ? (
					<span className="whitespace-pre-wrap">
						{message.content}
						{showCursor && (
							<span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-foreground/70 align-middle" />
						)}
					</span>
				) : (
					<span className="flex items-center gap-1.5 text-muted-foreground">
						<Loader2 className="size-3.5 animate-spin" />
						Thinking…
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
		<div className="flex h-full w-full flex-col border-r bg-muted/20 md:w-64 md:shrink-0">
			<div className="flex items-center justify-between gap-2 border-b p-3">
				<p className="font-medium text-sm">Conversations</p>
				<Button
					size="sm"
					variant="outline"
					className="h-7 gap-1 px-2"
					onClick={onNew}
				>
					<Plus className="size-3.5" />
					New
				</Button>
			</div>

			<div className="flex-1 overflow-y-auto p-2">
				{isLoading && (
					<div className="flex justify-center py-8">
						<Loader2 className="size-5 animate-spin text-muted-foreground" />
					</div>
				)}

				{!isLoading && conversations.length === 0 && (
					<div className="px-2 py-8 text-center text-muted-foreground text-xs">
						No conversations yet. Start chatting to save one.
					</div>
				)}

				{!isLoading &&
					conversations.map((c) => (
						<div
							key={c.id}
							className={cn(
								"group mb-1 flex items-start gap-1 rounded-lg transition-colors",
								activeId === c.id ? "bg-accent" : "hover:bg-accent/60",
							)}
						>
							<button
								type="button"
								className="min-w-0 flex-1 px-2.5 py-2 text-left"
								onClick={() => onSelect(c.id)}
							>
								<div className="flex items-center gap-1.5">
									<MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
									<p className="truncate font-medium text-sm">
										{c.title ?? "Untitled"}
									</p>
								</div>
								{c.preview && (
									<p className="mt-0.5 line-clamp-1 pl-5 text-muted-foreground text-xs">
										{c.preview}
									</p>
								)}
								{c.updatedAt && (
									<p className="mt-0.5 pl-5 text-muted-foreground/70 text-[0.65rem]">
										{new Date(c.updatedAt).toLocaleDateString("en-GB", {
											day: "numeric",
											month: "short",
											hour: "2-digit",
											minute: "2-digit",
										})}
									</p>
								)}
							</button>
							<button
								type="button"
								className="mr-1 mt-2 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
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
				text: found.transcript ?? "",
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
				text: conversationDetail.recording.transcript,
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

	return (
		<div className="flex h-[calc(100vh-9rem)] overflow-hidden rounded-xl border bg-card">
			{/* Desktop sidebar */}
			<div className="hidden md:flex">
				<ConversationSidebar
					activeId={conversationId}
					onSelect={selectConversation}
					onNew={startNewChat}
				/>
			</div>

			{/* Mobile conversation list sheet */}
			{showMobileList && (
				<div className="absolute inset-0 z-20 flex md:hidden">
					<div className="w-72 bg-background shadow-xl">
						<ConversationSidebar
							activeId={conversationId}
							onSelect={selectConversation}
							onNew={startNewChat}
						/>
					</div>
					<button
						type="button"
						className="flex-1 bg-black/40"
						aria-label="Close conversations"
						onClick={() => setShowMobileList(false)}
					/>
				</div>
			)}

			{/* Chat pane */}
			<div className="relative flex min-w-0 flex-1 flex-col">
				{/* Toolbar */}
				<div className="flex items-center justify-between gap-2 border-b px-3 py-2">
					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							size="sm"
							className="md:hidden"
							onClick={() => setShowMobileList(true)}
						>
							<MessageSquare className="size-4" />
						</Button>
						<ImportTranscriptDialog
							onImport={(ctx) => {
								userDismissedContextRef.current = false;
								setTranscriptContext(ctx);
							}}
						/>
						{conversationId && (
							<Button
								variant="ghost"
								size="sm"
								className="gap-1.5 text-muted-foreground"
								onClick={startNewChat}
							>
								<Plus className="size-4" />
								<span className="hidden sm:inline">New chat</span>
							</Button>
						)}
					</div>
					{isStreaming && (
						<Badge
							variant="outline"
							className="gap-1.5 border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-blue-300"
						>
							<Loader2 className="size-3 animate-spin" />
							AI is responding…
						</Badge>
					)}
				</div>

				{/* Context card */}
				{transcriptContext && (
					<div className="border-b px-3 py-2">
						<ContextCard
							context={transcriptContext}
							onRemove={() => {
								void removeTranscriptContext();
							}}
						/>
					</div>
				)}

				{/* Messages */}
				<div ref={scrollRef} className="flex-1 overflow-y-auto">
					{isLoadingConversation && conversationId ? (
						<div className="flex h-full items-center justify-center">
							<Loader2 className="size-6 animate-spin text-muted-foreground" />
						</div>
					) : messages.length === 0 ? (
						<div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
							<div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
								<Bot className="size-8 text-primary" />
							</div>
							<div>
								<p className="font-semibold text-lg">AI Medical Assistant</p>
								<p className="mt-1 text-muted-foreground text-sm">
									Ask me anything about patient consultations, symptoms,
									diagnoses, or treatment options. Conversations are saved
									automatically.
								</p>
							</div>
							{!transcriptContext && (
								<ImportTranscriptDialog
									onImport={(ctx) => {
										userDismissedContextRef.current = false;
										setTranscriptContext(ctx);
									}}
								/>
							)}
						</div>
					) : (
						<div className="space-y-4 p-4">
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

				{/* Input area */}
				<div className="border-t p-3">
					<div className="flex gap-3">
						<Textarea
							ref={textareaRef}
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="Ask a question… (Enter to send, Shift+Enter for new line)"
							className="min-h-[52px] max-h-36 resize-none"
							disabled={isStreaming}
							rows={1}
						/>
						<Button
							className="h-auto self-end"
							onClick={sendMessage}
							disabled={!input.trim() || isStreaming}
						>
							{isStreaming ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Send className="size-4" />
							)}
						</Button>
					</div>
					<p className="mt-2 text-center text-muted-foreground text-xs">
						Responses may contain inaccuracies — always apply clinical judgment
					</p>
				</div>
			</div>
		</div>
	);
}
