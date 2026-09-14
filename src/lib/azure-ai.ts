/**
 * AI helpers for the doctor recordings + chat features.
 *
 * Chat (Foundry / Azure OpenAI v1 Responses API):
 *   AZURE_OPENAI_ENDPOINT — e.g.
 *     https://<resource>.services.ai.azure.com/api/projects/<project>/openai/v1
 *     or https://<resource>.openai.azure.com/openai/v1
 *   AZURE_OPENAI_API_KEY
 *   AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-5-mini
 *
 * Transcription (classic Azure OpenAI deployments API):
 *   AZURE_TRANSCRIBE_ENDPOINT, AZURE_TRANSCRIBE_API_KEY, AZURE_TRANSCRIBE_DEPLOYMENT
 */

import OpenAI, { AzureOpenAI } from "openai";

export const CHAT_DEPLOYMENT =
	process.env.AZURE_OPENAI_CHAT_DEPLOYMENT ?? "gpt-5-mini";

const TRANSCRIBE_DEPLOYMENT =
	process.env.AZURE_TRANSCRIBE_DEPLOYMENT ?? "gpt-transcribe";

const TRANSCRIBE_API_VERSION =
	process.env.AZURE_TRANSCRIBE_API_VERSION ?? "2025-03-01-preview";

/**
 * Foundry / OpenAI v1 base URL for the Responses API.
 * Accepts a project root or a full …/responses URL and normalizes to …/openai/v1.
 */
function chatBaseURL(raw: string): string {
	let url = raw.trim().replace(/\/$/, "");
	url = url.replace(/\/responses$/i, "");
	if (!url.includes("/openai/v1")) {
		url = `${url}/openai/v1`;
	}
	return url;
}

/**
 * OpenAI-compatible client pointed at Foundry / Azure OpenAI v1.
 * Uses the Responses API (not chat.completions).
 */
export function createChatClient(): OpenAI {
	const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
	const apiKey = process.env.AZURE_OPENAI_API_KEY;

	if (!endpoint || !apiKey) {
		throw new Error(
			"Missing Azure OpenAI chat configuration. Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY.",
		);
	}

	return new OpenAI({
		apiKey,
		baseURL: chatBaseURL(endpoint),
		defaultHeaders: {
			"api-key": apiKey,
		},
	});
}

/** @deprecated Prefer createChatClient() — kept for any leftover imports */
export function createAzureOpenAI(): OpenAI {
	return createChatClient();
}

/**
 * Stream assistant text via the Responses API.
 * Yields plain text deltas.
 */
export async function* streamChatText(options: {
	instructions: string;
	messages: { role: "user" | "assistant"; content: string }[];
	maxOutputTokens?: number;
}): AsyncGenerator<string> {
	const client = createChatClient();

	const stream = await client.responses.create({
		model: CHAT_DEPLOYMENT,
		instructions: options.instructions,
		input: options.messages.map((m) => ({
			role: m.role,
			content: m.content,
		})),
		stream: true,
		max_output_tokens: options.maxOutputTokens ?? 2048,
	});

	for await (const event of stream) {
		if (event.type === "response.output_text.delta" && event.delta) {
			yield event.delta;
		}
	}
}

function createAzureTranscribeClient(): AzureOpenAI {
	const endpoint = process.env.AZURE_TRANSCRIBE_ENDPOINT;
	const apiKey = process.env.AZURE_TRANSCRIBE_API_KEY;

	if (!endpoint || !apiKey) {
		throw new Error(
			"Missing Azure transcription configuration. Set AZURE_TRANSCRIBE_ENDPOINT and AZURE_TRANSCRIBE_API_KEY.",
		);
	}

	return new AzureOpenAI({
		endpoint,
		apiKey,
		apiVersion: TRANSCRIBE_API_VERSION,
	});
}

/**
 * Transcribe a consultation recording with Azure OpenAI gpt-transcribe.
 * Routes call only this — swap the implementation here if you change models.
 */
export async function transcribeAudio(
	audio: Blob,
	filename: string,
): Promise<string> {
	const client = createAzureTranscribeClient();
	const file = new File([audio], filename, {
		type: audio.type || "audio/webm",
	});

	const result = (await client.audio.transcriptions.create({
		model: TRANSCRIBE_DEPLOYMENT,
		file,
		response_format: "text",
	})) as unknown;

	return typeof result === "string"
		? result
		: (result as { text: string }).text;
}
