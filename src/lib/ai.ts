/**
 * AI helpers for the doctor recordings + chat features.
 *
 * Chat (OpenRouter chat completions):
 *   OPENROUTER_API_KEY
 *   OPENROUTER_CHAT_MODEL=deepseek/deepseek-v4-flash-0731 (optional)
 *
 * Transcription (OpenRouter):
 *   OPENROUTER_API_KEY
 */

import OpenAI from "openai";
import {
	type ConsultationSummary,
	consultationSummarySchema,
} from "@/lib/consultation-summary";
import { formatSpeakerLabel } from "@/lib/transcript";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_TRANSCRIBE_ENDPOINT = `${OPENROUTER_BASE_URL}/audio/transcriptions`;

export const CHAT_MODEL =
	process.env.OPENROUTER_CHAT_MODEL ?? "deepseek/deepseek-v4-flash-0731";

function requireOpenRouterApiKey(): string {
	const apiKey = process.env.OPENROUTER_API_KEY;
	if (!apiKey) {
		throw new Error("Missing OPENROUTER_API_KEY in environment variables.");
	}
	return apiKey;
}

/**
 * OpenAI-compatible client pointed at OpenRouter.
 */
export function createChatClient(): OpenAI {
	return new OpenAI({
		apiKey: requireOpenRouterApiKey(),
		baseURL: OPENROUTER_BASE_URL,
		defaultHeaders: {
			"HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://riaya.app",
			"X-Title": "Riaya",
		},
	});
}

/** What one chat completion used, from OpenRouter's final stream chunk. */
export type ChatUsage = {
	promptTokens: number;
	completionTokens: number;
	/** Cost in millionths of a USD, as billed by OpenRouter; null if not reported */
	costMicroUsd: number | null;
};

/**
 * Stream assistant text via OpenRouter chat completions.
 * Yields plain text deltas; `onUsage` gets the request's token use and cost
 * once the stream ends.
 */
export async function* streamChatText(options: {
	instructions: string;
	messages: { role: "user" | "assistant"; content: string }[];
	maxOutputTokens?: number;
	onUsage?: (usage: ChatUsage) => void;
	/** Aborting ends the request to the model. */
	signal?: AbortSignal;
}): AsyncGenerator<string> {
	const client = createChatClient();

	const stream = await client.chat.completions.create(
		{
			model: CHAT_MODEL,
			messages: [
				{ role: "system", content: options.instructions },
				...options.messages,
			],
			stream: true,
			stream_options: { include_usage: true },
			max_tokens: options.maxOutputTokens ?? 2048,
		},
		{ signal: options.signal },
	);

	for await (const chunk of stream) {
		const delta = chunk.choices[0]?.delta?.content;
		if (delta) yield delta;
		if (chunk.usage) options.onUsage?.(usageFrom(chunk.usage));
	}
}

function usageFrom(usage: OpenAI.CompletionUsage | undefined): ChatUsage {
	// OpenRouter adds `cost` (USD) to the standard usage object
	const cost = (usage as { cost?: number } | undefined)?.cost;
	return {
		promptTokens: usage?.prompt_tokens ?? 0,
		completionTokens: usage?.completion_tokens ?? 0,
		costMicroUsd:
			typeof cost === "number" ? Math.round(cost * 1_000_000) : null,
	};
}

const SUMMARY_INSTRUCTIONS = `You turn a doctor–patient consultation transcript into a short clinical note for the patient's file.

Return only a JSON object with these string fields:
- "reason": why the patient came, in one or two sentences
- "history": relevant symptoms, their duration and history mentioned
- "examination": examination findings and measurements mentioned
- "assessment": the doctor's assessment or working diagnosis, as the doctor stated it
- "plan": treatment, prescriptions, tests, advice and follow-up the doctor gave

Rules:
- Write in French, the usual language of medical records in Tunisia, even when the conversation is in Tunisian Derja or Arabic. Keep drug names and doses exactly as said.
- Use only what was said. Never add a diagnosis, finding or treatment the doctor didn't state. If a section wasn't discussed, use an empty string.
- Be concise: short sentences or "-" bullet lines, no greetings or filler.`;

/** Writes a structured consultation note from a transcript (non-streaming). */
export async function generateConsultationSummary(
	transcriptText: string,
): Promise<{ summary: ConsultationSummary; usage: ChatUsage }> {
	const client = createChatClient();
	const completion = await client.chat.completions.create({
		model: CHAT_MODEL,
		messages: [
			{ role: "system", content: SUMMARY_INSTRUCTIONS },
			{ role: "user", content: transcriptText },
		],
		response_format: { type: "json_object" },
		max_tokens: 1500,
	});

	const raw = completion.choices[0]?.message?.content ?? "";
	const parsed = consultationSummarySchema.parse(
		JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")),
	);
	return { summary: parsed, usage: usageFrom(completion.usage) };
}

export type TranscriptWord = {
	word: string;
	start: number;
	end: number;
	speaker?: string | number;
};

export type TranscriptSegment = {
	id: number;
	start: number;
	end: number;
	text: string;
	speaker?: string;
	words?: TranscriptWord[];
};

export type TranscriptResponse = {
	text: string;
	language?: string;
	duration?: number;
	segments: TranscriptSegment[];
	words?: TranscriptWord[];
};

function speakerForSegment(
	segment: {
		start?: number;
		end?: number;
		speaker?: unknown;
		words?: TranscriptWord[];
	},
	topWords: TranscriptWord[],
): unknown {
	if (segment.speaker != null && segment.speaker !== "") {
		return segment.speaker;
	}
	const nested = segment.words?.find((w) => w.speaker != null)?.speaker;
	if (nested != null) return nested;
	if (!topWords.length) return undefined;
	const start = Number(segment.start);
	const end = Number(segment.end);
	if (!Number.isFinite(start) || !Number.isFinite(end)) return undefined;
	const mid = (start + end) / 2;
	return (
		topWords.find(
			(w) =>
				w.speaker != null && Number(w.start) <= mid && mid <= Number(w.end),
		)?.speaker ??
		topWords.find(
			(w) =>
				w.speaker != null && Number(w.start) >= start && Number(w.start) < end,
		)?.speaker
	);
}

function normalizeTranscript(raw: TranscriptResponse): TranscriptResponse {
	const topWords = Array.isArray(raw.words) ? raw.words : [];
	const segments = (raw.segments ?? []).map((segment) => ({
		...segment,
		speaker: formatSpeakerLabel(speakerForSegment(segment, topWords)),
	}));
	return { ...raw, segments };
}

/**
 * Transcribe a consultation recording with OpenRouter microsoft/mai-transcribe-2.
 * Routes call only this — swap the implementation here if you change models.
 */
export async function transcribeAudio(
	audio: Blob,
	filename: string,
): Promise<TranscriptResponse> {
	const apiKey = requireOpenRouterApiKey();

	// Determine audio format from filename or MIME type
	const ext = filename.split(".").pop()?.toLowerCase() ?? "webm";

	// OpenRouter expects JSON with base64-encoded audio
	const arrayBuffer = await audio.arrayBuffer();
	const base64Audio = Buffer.from(arrayBuffer).toString("base64");

	const response = await fetch(OPENROUTER_TRANSCRIBE_ENDPOINT, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: "microsoft/mai-transcribe-2",
			input_audio: {
				data: base64Audio,
				format: ext,
			},
			response_format: "verbose_json",
			timestamp_granularities: ["segment", "word"],
			provider: {
				options: {
					azure: {
						diarization: { enabled: true },
					},
				},
			},
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(
			`OpenRouter transcription failed: ${response.status} ${errorText}`,
		);
	}

	return normalizeTranscript(await response.json());
}
