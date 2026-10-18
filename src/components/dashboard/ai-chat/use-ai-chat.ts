import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { mutate as mutateSWR } from "swr";
import type { AiChatMessageStatus } from "@/db/schema";
import {
	type AiActionPart,
	type AiChatPart,
	applyReplyEvent,
	type ReplyEvent,
} from "@/lib/ai-chat-parts";
import { getErrorMessage } from "@/lib/error-handling";
import { transcriptContextFromRecording } from "@/lib/transcript";
import {
	getGetApiAiChatConversationsIdKey,
	postApiAiChatConversationsIdStop,
	useGetApiAiChatConversations,
	useGetApiAiChatConversationsId,
} from "@/services/generated/ai-chat/ai-chat";
import { useGetApiRecordings } from "@/services/generated/recordings/recordings";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Role = "user" | "assistant";
export type Message = {
	id: string;
	role: Role;
	parts: AiChatPart[];
	status: AiChatMessageStatus;
};

/** The reply is still being written (here or after the page was reopened). */
export function isLive(message: Message) {
	return message.status === "streaming" || message.status === "stopping";
}
export type TranscriptContext = {
	recordingId: number;
	title: string;
	text: string;
};

// ─── Chat state ───────────────────────────────────────────────────────────────

/**
 * One AI conversation: its messages, sending and stopping replies, following
 * a reply written elsewhere, the attached transcript and action updates.
 * Shared by the AI Assistant page and the dashboard's side panel.
 */
export function useAiChat({
	preloadRecordingId = null,
	onPreloadCleared,
	page,
	autoFocus = true,
}: {
	/** A recording to attach as context when starting a new chat (`?transcript=`). */
	preloadRecordingId?: string | null;
	/** Called when the doctor removes that pre-attached recording. */
	onPreloadCleared?: () => void;
	/** The dashboard page the doctor is on, so the assistant knows what "this" is. */
	page?: string;
	autoFocus?: boolean;
} = {}) {
	const [conversationId, setConversationId] = useState<number | null>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [isStreaming, setIsStreaming] = useState(false);
	const [transcriptContext, setTranscriptContext] =
		useState<TranscriptContext | null>(null);

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
		if (autoFocus) textareaRef.current?.focus();
	}, [autoFocus]);

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
				parts: m.parts as AiChatPart[],
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
					speakerRoles: conversationDetail.recording.speakerRoles,
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

		if (preloadRecordingId) onPreloadCleared?.();

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
	}, [
		conversationId,
		preloadRecordingId,
		onPreloadCleared,
		mutateConversationDetail,
	]);

	const startNewChat = useCallback(() => {
		if (abortRef.current) abortRef.current.abort();
		setConversationId(null);
		setMessages([]);
		setIsStreaming(false);
		contextSyncedForConversationRef.current = null;
		messagesSyncedForConversationRef.current = null;
		// Keep context only while `?transcript=` is still present (user hasn't removed it).
		if (!preloadRecordingId) {
			didPreloadFromUrlRef.current = false;
			userDismissedContextRef.current = false;
			setTranscriptContext(null);
		}
		focusComposer();
	}, [preloadRecordingId, focusComposer]);

	const selectConversation = useCallback(
		(id: number) => {
			if (abortRef.current) abortRef.current.abort();
			setIsStreaming(false);
			userDismissedContextRef.current = false;
			contextSyncedForConversationRef.current = null;
			messagesSyncedForConversationRef.current = null;
			stickToBottomRef.current = true;
			setConversationId(id);
			focusComposer();
		},
		[focusComposer],
	);

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
				parts: [{ type: "text", text }],
				status: "done",
			};
			const assistantMessage: Message = {
				id: crypto.randomUUID(),
				role: "assistant",
				parts: [],
				status: "streaming",
			};

			stickToBottomRef.current = true;
			setMessages((prev) => [...prev, userMessage, assistantMessage]);
			setInput("");
			setIsStreaming(true);
			focusComposer();

			abortRef.current = new AbortController();
			let resolvedConversationId = conversationId;
			/** Once true, the server saved the turn; errors after it are on the reply. */
			let replyStarted = false;
			try {
				const res = await fetch("/api/ai-chat", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						message: text,
						conversationId: conversationId ?? undefined,
						recordingId: transcriptContext?.recordingId,
						transcriptContext: transcriptContext?.text,
						page,
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

				// One JSON event per line; a chunk can end mid-line
				const reader = res.body.getReader();
				const decoder = new TextDecoder();
				let buffer = "";
				for (;;) {
					const { value, done } = await reader.read();
					if (done) break;
					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split("\n");
					buffer = lines.pop() ?? "";
					const events = lines
						.filter((line) => line.trim())
						.map((line) => JSON.parse(line) as ReplyEvent);
					if (!events.length) continue;
					setMessages((prev) =>
						prev.map((m) =>
							m.id === assistantMessage.id
								? { ...m, parts: events.reduce(applyReplyEvent, m.parts) }
								: m,
						),
					);
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
			page,
			mutateConversationList,
			focusComposer,
		],
	);

	// A card confirmed or dismissed an action. Update the page and the cached
	// conversation at once, so a refetch can't bring back the old "proposed"
	// card while the outcome is being saved.
	const updateActionPart = useCallback(
		(messageId: string, part: AiActionPart) => {
			const replace = (parts: AiChatPart[]) =>
				parts.map((p) => (p.type === "action" && p.id === part.id ? part : p));
			setMessages((prev) =>
				prev.map((m) =>
					m.id === messageId ? { ...m, parts: replace(m.parts) } : m,
				),
			);
			void mutateConversationDetail(
				(detail) =>
					detail && {
						...detail,
						messages: detail.messages.map((m) =>
							String(m.id) === messageId
								? { ...m, parts: replace(m.parts as AiChatPart[]) }
								: m,
						),
					},
				{ revalidate: false },
			);
		},
		[mutateConversationDetail],
	);

	const headerTitle =
		conversationDetail?.title ??
		(conversationId ? "Conversation" : "New conversation");
	const liveReply = messages.find(isLive);
	const canSend = Boolean(input.trim()) && !isStreaming && !liveReply;

	return {
		conversationId,
		conversationDetail,
		isLoadingConversation,
		messages,
		input,
		setInput,
		isStreaming,
		liveReply,
		canSend,
		headerTitle,
		transcriptContext,
		attachTranscript,
		removeTranscriptContext,
		startNewChat,
		selectConversation,
		sendMessage,
		stopReply,
		updateActionPart,
		textareaRef,
		scrollRef,
		handleScroll,
	};
}

export type AiChatState = ReturnType<typeof useAiChat>;
