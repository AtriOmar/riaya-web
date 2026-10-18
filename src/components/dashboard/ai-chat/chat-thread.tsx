"use client";

import {
	ArrowUp,
	CalendarCheck,
	CalendarClock,
	CalendarDays,
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
	Paperclip,
	Receipt,
	Sparkles,
	Square,
	TriangleAlert,
	UserPlus,
	X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { type AiActionPart, partsText } from "@/lib/ai-chat-parts";
import { recordingTitle } from "@/lib/recording-title";
import {
	formatTranscriptForAiContext,
	transcriptContextFromRecording,
} from "@/lib/transcript";
import { cn } from "@/lib/utils";
import { useGetApiDashboardStats } from "@/services/generated/dashboard/dashboard";
import { useGetApiRecordings } from "@/services/generated/recordings/recordings";
import { MessageParts } from "./parts/message-parts";

import {
	type AiChatState,
	isLive,
	type Message,
	type TranscriptContext,
} from "./use-ai-chat";

// ─── Suggestions ──────────────────────────────────────────────────────────────

export type Suggestion = {
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

/**
 * Suggestions from the practice's real numbers (pending bookings, today's
 * patients, unpaid invoices), topped up with the general ones.
 */
function practiceSuggestions(counts?: {
	appointmentsToday: number;
	pendingAppointments: number;
	unpaidInvoices: number;
}): Suggestion[] {
	const fromPractice: Suggestion[] = [];
	if (counts?.pendingAppointments) {
		const n = counts.pendingAppointments;
		fromPractice.push({
			label: `Review ${n} pending booking${n === 1 ? "" : "s"}`,
			description: "Accept or refuse them here",
			prompt: "Show my pending bookings and help me decide on them.",
			icon: CalendarClock,
		});
	}
	if (counts?.appointmentsToday) {
		const n = counts.appointmentsToday;
		fromPractice.push({
			label: "Brief me on today",
			description: `${n} appointment${n === 1 ? "" : "s"} today`,
			prompt: "What does my day look like? Brief me on today's patients.",
			icon: CalendarDays,
		});
	}
	if (counts?.unpaidInvoices) {
		const n = counts.unpaidInvoices;
		fromPractice.push({
			label: "Who still owes me?",
			description: `${n} unpaid invoice${n === 1 ? "" : "s"}`,
			prompt: "Which invoices are still unpaid, and how much is owed in total?",
			icon: Receipt,
		});
	}
	return [...fromPractice, ...CLINICAL_SUGGESTIONS].slice(0, 3);
}

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
													{recordingTitle(r)}
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
															speakerRoles: r.speakerRoles,
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

function MessageBubble({
	message,
	onActionChange,
}: {
	message: Message;
	onActionChange: (messageId: string, part: AiActionPart) => void;
}) {
	const text = partsText(message.parts);

	if (message.role === "user") {
		return (
			<div className="flex justify-end">
				<div
					dir="auto"
					className="max-w-[min(85%,36rem)] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground text-sm leading-relaxed shadow-sm"
				>
					{text}
				</div>
			</div>
		);
	}

	const live = isLive(message);
	/** Saved messages have a numeric id; the one being streamed has a temporary one. */
	const messageId = /^\d+$/.test(message.id) ? Number(message.id) : null;
	const lastPart = message.parts.at(-1);
	const waiting = live && (!lastPart || lastPart.type !== "text");

	return (
		<div className="group flex gap-3">
			<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
				<Sparkles className="size-3.5" />
			</div>

			<div className="min-w-0 flex-1 pt-1">
				<MessageParts
					parts={message.parts}
					messageId={messageId}
					live={live}
					onActionChange={(part) => onActionChange(message.id, part)}
				/>
				{waiting &&
					!message.parts.some(
						(p) => p.type === "tool" && p.status === "running",
					) && (
						<span className="flex h-6 items-center gap-1 text-muted-foreground">
							<span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.3s]" />
							<span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.15s]" />
							<span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70" />
						</span>
					)}
				{!live && (
					<div className="mt-1.5 flex min-h-7 items-center gap-2">
						{message.status === "stopped" && (
							<p className="text-muted-foreground text-xs">
								{message.parts.length ? "Stopped" : "Stopped before answering"}
							</p>
						)}
						{message.status === "failed" && (
							<p className="text-destructive text-xs">
								{message.parts.length
									? "The reply was cut off. Ask again to get the rest."
									: "Something went wrong and no reply was written. Try again."}
							</p>
						)}
						{text && <CopyMessageButton text={text} />}
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

// ─── Thread: messages and composer ────────────────────────────────────────────

/**
 * The messages of the current conversation and the composer. The AI page
 * shows it next to the conversation list; the side panel shows it compact.
 */
export function ChatThread({
	chat,
	compact = false,
	leadSuggestions = [],
}: {
	chat: AiChatState;
	compact?: boolean;
	/** Suggestions put first, e.g. about the page the doctor is on. */
	leadSuggestions?: Suggestion[];
}) {
	const { data: stats } = useGetApiDashboardStats();
	const { liveReply } = chat;
	const suggestions = chat.transcriptContext
		? TRANSCRIPT_SUGGESTIONS
		: [...leadSuggestions, ...practiceSuggestions(stats?.counts)].slice(0, 3);

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			chat.sendMessage();
		}
	};

	return (
		<>
			{/* Messages */}
			<div
				ref={chat.scrollRef}
				onScroll={chat.handleScroll}
				className="min-h-0 flex-1 overflow-y-auto"
			>
				{chat.isLoadingConversation && chat.conversationId ? (
					<div className="flex h-full items-center justify-center">
						<Loader2 className="size-6 animate-spin text-muted-foreground" />
					</div>
				) : chat.messages.length === 0 ? (
					<div
						className={cn(
							"flex min-h-full flex-col items-center justify-center",
							compact
								? "gap-5 px-4 py-6"
								: "gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-10",
						)}
					>
						<div className="flex flex-col items-center text-center">
							<div
								className={cn(
									"flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/20",
									compact ? "size-11" : "size-14",
								)}
							>
								<Sparkles className={compact ? "size-5" : "size-6"} />
							</div>
							<h2
								className={cn(
									"font-semibold tracking-tight",
									compact ? "mt-4 text-lg" : "mt-5 text-2xl",
								)}
							>
								How can I help today?
							</h2>
							<p className="mt-2 max-w-md text-muted-foreground text-sm leading-relaxed">
								{chat.transcriptContext
									? "Ask anything about the attached transcript."
									: "Ask about consultations, symptoms, or how to use Riaya."}
							</p>
						</div>
						<div
							className={cn(
								"grid w-full gap-2.5",
								!compact && "max-w-2xl sm:grid-cols-3",
							)}
						>
							{suggestions.map((item) => (
								<button
									key={item.label}
									type="button"
									className={cn(
										"group flex items-center gap-3 rounded-xl border bg-background p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
										!compact && "sm:flex-col sm:items-start sm:p-4",
									)}
									onClick={() => chat.sendMessage(item.prompt)}
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
					<div
						className={cn(
							"mx-auto w-full space-y-6",
							compact ? "px-3.5 py-4" : "max-w-3xl px-4 py-6",
						)}
					>
						{chat.messages.map((msg) => (
							<MessageBubble
								key={msg.id}
								message={msg}
								onActionChange={chat.updateActionPart}
							/>
						))}
					</div>
				)}
			</div>

			{/* Composer */}
			<div
				className={cn(
					"shrink-0 bg-gradient-to-t from-card via-card to-card/80 px-3 pb-3 pt-1",
					!compact && "sm:px-4",
				)}
			>
				<div
					className={cn("mx-auto w-full space-y-2", !compact && "max-w-3xl")}
				>
					{chat.transcriptContext && (
						<ContextChip
							context={chat.transcriptContext}
							onRemove={() => {
								void chat.removeTranscriptContext();
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
							ref={chat.textareaRef}
							value={chat.input}
							onChange={(e) => chat.setInput(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="Ask anything, or attach a transcript…"
							className="max-h-40 min-h-12 field-sizing-fixed resize-none border-0 bg-transparent px-4 py-3 shadow-none focus-visible:border-transparent focus-visible:ring-0 disabled:bg-transparent dark:bg-transparent dark:disabled:bg-transparent"
							rows={1}
						/>
						<div className="flex items-center justify-between gap-2 px-2 pb-2">
							<AttachTranscriptDialog onAttach={chat.attachTranscript}>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className={cn(
										"h-8 gap-1.5 rounded-full px-2.5 text-muted-foreground",
										chat.transcriptContext &&
											"bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
									)}
									disabled={Boolean(liveReply)}
									aria-label={
										chat.transcriptContext
											? "Replace attached transcript"
											: "Attach transcript"
									}
								>
									<Paperclip className="size-4" />
									<span className={compact ? "sr-only" : "hidden sm:inline"}>
										{chat.transcriptContext ? "Replace" : "Attach"}
									</span>
								</Button>
							</AttachTranscriptDialog>

							<Button
								type="button"
								size="icon"
								className="size-9 rounded-full"
								onMouseDown={(e) => e.preventDefault()}
								onClick={liveReply ? chat.stopReply : () => chat.sendMessage()}
								disabled={
									liveReply ? liveReply.status === "stopping" : !chat.canSend
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
						Responses may contain inaccuracies — always apply clinical judgment
					</p>
				</div>
			</div>
		</>
	);
}
