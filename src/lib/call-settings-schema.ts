import { z } from "zod";

/**
 * Per-call model choices made on /test-call. Saved to Redis for the voice
 * server and agent to read when the call starts. Keep this shape identical to
 * `voice/src/settings/callSettings.ts`. Every field is optional: a missing one
 * means "use the server's .env default". Any combination is accepted.
 */

const reasoning = z.enum(["none", "minimal"]);

export const callSettingsSchema = z.object({
	pipeline: z
		.object({
			stt: z
				.object({
					api: z.enum([
						"openrouter-chat",
						"openrouter-transcription",
						"google",
						"openai",
						"livekit-inference",
						"inworld",
					]),
					model: z.string().min(1),
					reasoning: reasoning.optional(),
				})
				.optional(),
			llm: z
				.object({
					provider: z.enum(["openrouter", "google", "livekit-inference"]),
					model: z.string().min(1),
				})
				.optional(),
			tts: z
				.object({
					provider: z.enum([
						"gemini-openrouter",
						"gemini-google",
						"openai",
						"openrouter",
						"inworld",
						"inference",
					]),
					model: z.string().min(1),
					voice: z.string().optional(),
				})
				.optional(),
		})
		.optional(),
	phone: z
		.object({
			realtime: z
				.object({
					backend: z.enum(["gemini", "openai", "gpt-live"]),
					model: z.string().min(1),
					voice: z.string().optional(),
				})
				.optional(),
			callerStt: z
				.object({
					api: z.enum(["off", "openrouter-chat", "openrouter-transcription"]),
					model: z.string().optional(),
					reasoning: reasoning.optional(),
				})
				.optional(),
		})
		.optional(),
});

export type CallSettings = z.infer<typeof callSettingsSchema>;
