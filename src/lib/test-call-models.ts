import type { CallSettings } from "@/lib/call-settings-schema";

/**
 * Models offered on /test-call, with what we learned about each one while
 * testing (see voice/MODEL_NOTES.md). Ratings and prices are static: update them
 * here when the notes change. Any combination can be picked; the ratings are
 * hints only.
 */

export type Rating = "recommended" | "good" | "ok" | "bad" | "untested";

export type ModelOption<T> = {
	id: string;
	label: string;
	rating: Rating;
	/** What we saw when we tried it. */
	note: string;
	/** Human-readable price. */
	price: string;
	speed?: string;
	value: T;
};

type Pipeline = NonNullable<CallSettings["pipeline"]>;
type Phone = NonNullable<CallSettings["phone"]>;
export type SttValue = NonNullable<Pipeline["stt"]>;
export type LlmValue = NonNullable<Pipeline["llm"]>;
export type TtsValue = NonNullable<Pipeline["tts"]>;
export type RealtimeValue = NonNullable<Phone["realtime"]>;
export type CallerSttValue = NonNullable<Phone["callerStt"]>;

// ─── Speech-to-text (LiveKit agent) ──────────────────────────────────────────

export const STT_OPTIONS: ModelOption<SttValue>[] = [
	{
		id: "or-chat-gemini-3.1-flash-lite",
		label: "Gemini 3.1 Flash-Lite (OpenRouter, chat)",
		rating: "good",
		note: "Pretty good. Whole sentences, no streaming. Keeps French in Latin script.",
		price: "$0.25 in / $1.50 out per M tokens",
		speed: "~0.8 s",
		value: {
			api: "openrouter-chat",
			model: "google/gemini-3.1-flash-lite",
			reasoning: "minimal",
		},
	},
	{
		id: "or-chat-gemini-3-flash-preview",
		label: "Gemini 3 Flash Preview (OpenRouter, chat)",
		rating: "good",
		note: "Good but slow. Once wrote a dialogue instead of a transcript on a long chunk.",
		price: "$0.50 in / $3.00 out per M tokens",
		speed: "~1.5 s",
		value: {
			api: "openrouter-chat",
			model: "google/gemini-3-flash-preview",
			reasoning: "minimal",
		},
	},
	{
		id: "or-chat-gemini-2.5-flash",
		label: "Gemini 2.5 Flash (OpenRouter, chat)",
		rating: "good",
		note: "Follows the audio well. Whole sentences, no streaming.",
		price: "$0.30 in / $2.50 out per M tokens",
		speed: "~1.7-2.8 s",
		value: {
			api: "openrouter-chat",
			model: "google/gemini-2.5-flash",
			reasoning: "none",
		},
	},
	{
		id: "or-chat-gemini-2.5-flash-lite",
		label: "Gemini 2.5 Flash-Lite (OpenRouter, chat)",
		rating: "bad",
		note: "Rated not good.",
		price: "$0.10 in / $0.40 out per M tokens",
		value: {
			api: "openrouter-chat",
			model: "google/gemini-2.5-flash-lite",
			reasoning: "none",
		},
	},
	{
		id: "or-chat-gemini-3.5-flash-lite",
		label: "Gemini 3.5 Flash-Lite (OpenRouter, chat)",
		rating: "bad",
		note: "Writes Derja in Latin letters and drops parts of longer sentences.",
		price: "$0.30 in / $2.50 out per M tokens",
		speed: "~1.5 s",
		value: {
			api: "openrouter-chat",
			model: "google/gemini-3.5-flash-lite",
			reasoning: "minimal",
		},
	},
	{
		id: "or-chat-mimo",
		label: "Xiaomi MiMo v2.6 Flash (OpenRouter, chat)",
		rating: "untested",
		note: "Reasoning model: needs reasoning off. Derja accuracy was mixed.",
		price: "$0.14 in / $0.28 out per M tokens",
		value: {
			api: "openrouter-chat",
			model: "xiaomi/mimo-v2.6-flash",
			reasoning: "none",
		},
	},
	{
		id: "or-tr-gpt-transcribe",
		label: "GPT Transcribe (OpenRouter)",
		rating: "ok",
		note: "Clean Derja and French. French words in code-switches come out in Arabic script.",
		price: "Not checked",
		speed: "~1-1.7 s",
		value: { api: "openrouter-transcription", model: "openai/gpt-transcribe" },
	},
	{
		id: "or-tr-gpt-4o-mini-transcribe",
		label: "GPT-4o mini Transcribe (OpenRouter)",
		rating: "untested",
		note: "Fast, but French words in code-switches come out in Arabic script.",
		price: "Not checked",
		speed: "~1-1.8 s",
		value: {
			api: "openrouter-transcription",
			model: "openai/gpt-4o-mini-transcribe",
		},
	},
	{
		id: "or-tr-gemini-3.5-transcribe",
		label: "Gemini 3.5 Transcribe (OpenRouter)",
		rating: "untested",
		note: "Clean French and English; some French words in Arabic script on phone audio.",
		price: "$2.00 in / $12.00 out per M tokens",
		speed: "~3 s",
		value: {
			api: "openrouter-transcription",
			model: "google/gemini-3.5-transcribe",
		},
	},
	{
		id: "or-tr-muse",
		label: "Meta Muse Voice Transcribe 1.0 (OpenRouter)",
		rating: "untested",
		note: "Works on all sample clips; Derja close.",
		price: "Not checked",
		speed: "~2.5-4 s",
		value: {
			api: "openrouter-transcription",
			model: "meta/muse-voice-transcribe-1.0",
		},
	},
	{
		id: "or-tr-whisper-turbo",
		label: "Whisper large v3 turbo (OpenRouter)",
		rating: "untested",
		note: "Fast, but turns French words in code-switches into Arabic script.",
		price: "Per provider; unit not stated",
		speed: "~1-3 s",
		value: {
			api: "openrouter-transcription",
			model: "openai/whisper-large-v3-turbo",
		},
	},
	{
		id: "lk-gemini-3.5-transcribe-live",
		label: "Gemini 3.5 Transcribe Live (LiveKit Inference)",
		rating: "untested",
		note: "Streaming: partial text while the caller speaks.",
		price: "LiveKit Inference rates",
		value: {
			api: "livekit-inference",
			model: "google/gemini-3.5-transcribe-live",
		},
	},
	{
		id: "lk-deepgram-nova-3",
		label: "Deepgram Nova-3 (LiveKit Inference)",
		rating: "bad",
		note: "Loses French/English with an Arabic hint; Derja empty in auto mode.",
		price: "LiveKit Inference rates",
		value: { api: "livekit-inference", model: "deepgram/nova-3" },
	},
	{
		id: "lk-assemblyai",
		label: "AssemblyAI Universal 3.5 Pro (LiveKit Inference)",
		rating: "bad",
		note: "Not accurate in Arabic; does not transliterate French.",
		price: "LiveKit Inference rates",
		value: {
			api: "livekit-inference",
			model: "assemblyai/universal-3-5-pro",
		},
	},
	{
		id: "openai-gpt-transcribe",
		label: "GPT Transcribe (OpenAI, streaming)",
		rating: "ok",
		note: "Streams. French words in code-switches come out in Arabic script.",
		price: "Not checked",
		value: { api: "openai", model: "gpt-transcribe" },
	},
	{
		id: "google-gemini-3.5-transcribe",
		label: "Gemini 3.5 Transcribe (Google API)",
		rating: "untested",
		note: "Free tier allows only 3 requests per minute.",
		price: "Not checked",
		value: { api: "google", model: "gemini-3.5-transcribe" },
	},
];

// ─── LLM (LiveKit agent) ─────────────────────────────────────────────────────

export const LLM_OPTIONS: ModelOption<LlmValue>[] = [
	{
		id: "or-gemini-2.5-flash",
		label: "Gemini 2.5 Flash (OpenRouter)",
		rating: "good",
		note: "Follows context well; speed is all right.",
		price: "$0.30 in / $2.50 out per M tokens",
		value: { provider: "openrouter", model: "google/gemini-2.5-flash" },
	},
	{
		id: "or-gemini-2.5-flash-lite",
		label: "Gemini 2.5 Flash-Lite (OpenRouter)",
		rating: "bad",
		note: "Not smart enough.",
		price: "$0.10 in / $0.40 out per M tokens",
		value: { provider: "openrouter", model: "google/gemini-2.5-flash-lite" },
	},
	{
		id: "or-gemini-3.1-flash-lite",
		label: "Gemini 3.1 Flash-Lite (OpenRouter)",
		rating: "untested",
		note: "Set briefly, no rating yet.",
		price: "$0.25 in / $1.50 out per M tokens",
		value: { provider: "openrouter", model: "google/gemini-3.1-flash-lite" },
	},
	{
		id: "or-gemini-3.8-flash",
		label: "Gemini 3.8 Flash (OpenRouter)",
		rating: "bad",
		note: "Too slow.",
		price: "$0.75 in / $3.75 out per M tokens",
		speed: "slow",
		value: { provider: "openrouter", model: "google/gemini-3.8-flash" },
	},
	{
		id: "or-gpt-5.4-mini",
		label: "GPT-5.4 mini (OpenRouter)",
		rating: "untested",
		note: "The original LLM before the Gemini switch.",
		price: "$0.75 in / $4.50 out per M tokens",
		value: { provider: "openrouter", model: "openai/gpt-5.4-mini" },
	},
	{
		id: "or-haiku-5.5",
		label: "Claude Haiku 5.5 (OpenRouter)",
		rating: "untested",
		note: "Newest Haiku. Considered, not tried.",
		price: "$0.10 in / $0.50 out per M tokens",
		value: { provider: "openrouter", model: "anthropic/claude-haiku-5.5" },
	},
	{
		id: "or-gpt-4.1-mini",
		label: "GPT-4.1 mini (OpenRouter)",
		rating: "untested",
		note: "Considered, not tried.",
		price: "$0.40 in / $1.60 out per M tokens",
		value: { provider: "openrouter", model: "openai/gpt-4.1-mini" },
	},
	{
		id: "google-gemini-2.5-flash",
		label: "Gemini 2.5 Flash (Google API)",
		rating: "untested",
		note: "Same model through Google's API. Free tier is rate-limited.",
		price: "Not checked",
		value: { provider: "google", model: "gemini-2.5-flash" },
	},
];

// ─── Text-to-speech (LiveKit agent) ──────────────────────────────────────────

export const TTS_OPTIONS: ModelOption<TtsValue>[] = [
	{
		id: "google-gemini-3.8-flash-lite-tts",
		label: "Gemini 3.8 Flash-Lite TTS (Google API)",
		rating: "good",
		note: "Almost perfect Tunisian dialect. Streams audio, first sound in ~0.6-1.2 s. Free tier is rate-limited.",
		price: "$0.50 in / $6.00 out per M tokens",
		speed: "~0.6-1.2 s first audio",
		value: {
			provider: "gemini-google",
			model: "gemini-3.8-flash-lite-tts",
			voice: "Charon",
		},
	},
	{
		id: "or-gemini-3.8-flash-lite-tts",
		label: "Gemini 3.8 Flash-Lite TTS (OpenRouter)",
		rating: "ok",
		note: "Very good dialect but not streamed, so it waits for the whole reply.",
		price: "$0.50 in / $6.00 out per M tokens",
		speed: "~2 s",
		value: {
			provider: "gemini-openrouter",
			model: "google/gemini-3.8-flash-lite-tts",
			voice: "Charon",
		},
	},
	{
		id: "or-gemini-3.8-flash-tts",
		label: "Gemini 3.8 Flash TTS (OpenRouter)",
		rating: "bad",
		note: "Best dialect, but far too slow for a conversation.",
		price: "$0.50 in / $9.00 out per M tokens",
		speed: "~4-5 s",
		value: {
			provider: "gemini-openrouter",
			model: "google/gemini-3.8-flash-tts",
			voice: "Charon",
		},
	},
	{
		id: "google-gemini-3.1-flash-tts-preview",
		label: "Gemini 3.1 Flash TTS Preview (Google API)",
		rating: "ok",
		note: "Slow. Through OpenRouter the accent was not Tunisian.",
		price: "$1.00 in / $20.00 out per M tokens",
		speed: "~2 s",
		value: {
			provider: "gemini-google",
			model: "gemini-3.1-flash-tts-preview",
			voice: "Charon",
		},
	},
	{
		id: "google-gemini-2.5-flash-preview-tts",
		label: "Gemini 2.5 Flash Preview TTS (Google API)",
		rating: "untested",
		note: "Only on Google's API. Free tier is rate-limited.",
		price: "Not checked",
		value: {
			provider: "gemini-google",
			model: "gemini-2.5-flash-preview-tts",
			voice: "Charon",
		},
	},
	{
		id: "inference-xai-tts-1",
		label: "xAI TTS 1 (LiveKit Inference)",
		rating: "ok",
		note: "Very fast. Pronounces Arabic but not a Tunisian accent.",
		price: "$15 per M characters (to confirm)",
		speed: "~0.25 s",
		value: { provider: "inference", model: "xai/tts-1" },
	},
	{
		id: "inworld-tts-2",
		label: "Inworld TTS 2, voice Omar",
		rating: "ok",
		note: "Fast, but no Tunisian accent.",
		price: "Not checked",
		speed: "fast",
		value: { provider: "inworld", model: "inworld-tts-2", voice: "Omar" },
	},
	{
		id: "openai-gpt-4o-mini-tts",
		label: "GPT-4o mini TTS (OpenAI)",
		rating: "untested",
		note: "Not streamed, so it waits for the whole reply. Accepts accent instructions.",
		price: "Not checked",
		speed: "~3 s",
		value: { provider: "openai", model: "gpt-4o-mini-tts", voice: "coral" },
	},
	{
		id: "or-eleven-v4",
		label: "ElevenLabs v4 (OpenRouter)",
		rating: "bad",
		note: "Accent not that bad and ~1.5 s, but very expensive.",
		price: "~$40 per M characters (unit to confirm)",
		speed: "~1.5 s",
		value: {
			provider: "openrouter",
			model: "elevenlabs/eleven-v4",
			voice: "sarah",
		},
	},
	{
		id: "or-mai-voice",
		label: "Microsoft MAI Voice 2.1 Flash (OpenRouter)",
		rating: "bad",
		note: "Fast, but no Arabic voice and no Tunisian accent.",
		price: "$15 per M characters",
		speed: "~0.5 s",
		value: {
			provider: "openrouter",
			model: "microsoft/mai-voice-2.1-flash",
			voice: "fr-FR-Harper:MAI-Voice-2.1-Flash",
		},
	},
];

// ─── Realtime model (phone stream) ───────────────────────────────────────────

export const REALTIME_OPTIONS: ModelOption<RealtimeValue>[] = [
	{
		id: "gemini-3.1-flash-live-preview",
		label: "Gemini 3.1 Flash Live Preview",
		rating: "recommended",
		note: "Almost perfect Tunisian dialect, very fast, very good interruptions, best thinking. Its own transcript is very bad: pair it with a caller transcript model.",
		price: "Not checked",
		speed: "very fast",
		value: {
			backend: "gemini",
			model: "gemini-3.1-flash-live-preview",
			voice: "Puck",
		},
	},
	{
		id: "gemini-3.8-live",
		label: "Gemini 3.8 Live",
		rating: "ok",
		note: "Good dialect and fast, but doesn't understand well.",
		price: "Not checked",
		speed: "fast",
		value: { backend: "gemini", model: "gemini-3.8-live", voice: "Puck" },
	},
	{
		id: "gemini-3.8-live-extended-thinking",
		label: "Gemini 3.8 Live Extended Thinking",
		rating: "bad",
		note: "Decent accent and fast, but doesn't understand well.",
		price: "Not checked",
		speed: "fast",
		value: {
			backend: "gemini",
			model: "gemini-3.8-live-extended-thinking",
			voice: "Puck",
		},
	},
	{
		id: "gpt-realtime-2.1",
		label: "GPT Realtime 2.1 (OpenAI)",
		rating: "ok",
		note: "Good pronunciation, but weaker Arabic understanding and flow. Expensive.",
		price: "Per audio token; not checked",
		speed: "fast",
		value: { backend: "openai", model: "gpt-realtime-2.1" },
	},
	{
		id: "gpt-realtime-2",
		label: "GPT Realtime 2 (OpenAI)",
		rating: "untested",
		note: "Not rated yet. Expensive.",
		price: "Per audio token; not checked",
		speed: "fast",
		value: { backend: "openai", model: "gpt-realtime-2" },
	},
	{
		id: "gpt-realtime",
		label: "GPT Realtime (OpenAI)",
		rating: "good",
		note: "Smartest so far, good speech recognition, very good interruptions. Very expensive; shuts down 2027-01-20.",
		price: "Per audio token; very expensive",
		speed: "fast",
		value: { backend: "openai", model: "gpt-realtime" },
	},
	{
		id: "gpt-live-1",
		label: "GPT-Live 1 (OpenAI)",
		rating: "bad",
		note: "Too artificial and costly; interruptions good, flow not smooth.",
		price: "$0.05 per minute + backend model",
		speed: "fast",
		value: { backend: "gpt-live", model: "gpt-live-1" },
	},
];

// ─── Caller transcript (phone stream) ────────────────────────────────────────

const callerFrom = (
	o: ModelOption<SttValue>,
): ModelOption<CallerSttValue> | null =>
	o.value.api === "openrouter-chat" ||
	o.value.api === "openrouter-transcription"
		? {
				...o,
				value: {
					api: o.value.api,
					model: o.value.model,
					reasoning: o.value.reasoning,
				},
			}
		: null;

export const CALLER_STT_OPTIONS: ModelOption<CallerSttValue>[] = [
	{
		id: "caller-off",
		label: "Off: use the realtime model's own transcript",
		rating: "bad",
		note: "Gemini Live's built-in transcript is very bad on Derja.",
		price: "Included",
		value: { api: "off" },
	},
	...STT_OPTIONS.map(callerFrom).filter(
		(o): o is ModelOption<CallerSttValue> => o !== null,
	),
];
