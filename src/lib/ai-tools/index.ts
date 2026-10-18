import { z } from "zod";
import type { ChatTool, ChatToolCall } from "@/lib/ai";
import {
	type ActionToolName,
	type AiActionPart,
	type AiToolPart,
	actionToolSchemas,
	type ReadToolName,
	readToolSchemas,
} from "@/lib/ai-chat-parts";
import { actionTools } from "./action-tools";
import { readTools } from "./read-tools";
import { type ToolContext, ToolError } from "./shared";
import { toPracticeTime } from "./time";

export type { ToolContext } from "./shared";

function isReadTool(name: string): name is ReadToolName {
	return name in readToolSchemas;
}

function isActionTool(name: string): name is ActionToolName {
	return name in actionToolSchemas;
}

function parameters(schema: z.ZodType) {
	const { $schema: _, ...rest } = z.toJSONSchema(schema, { io: "input" });
	return rest;
}

/** Every tool, in the shape the model API expects. */
export const CHAT_TOOLS: ChatTool[] = [
	...(Object.keys(readTools) as ReadToolName[]).map((name) => ({
		type: "function" as const,
		function: {
			name,
			description: readTools[name].description,
			parameters: parameters(readToolSchemas[name].input),
		},
	})),
	...(Object.keys(actionTools) as ActionToolName[]).map((name) => ({
		type: "function" as const,
		function: {
			name,
			description: actionTools[name].description,
			parameters: parameters(actionToolSchemas[name].input),
		},
	})),
];

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** JSON for the model, with instants turned into Tunis wall-clock times. */
export function toModelJson(value: unknown): string {
	return JSON.stringify(value, (_key, v) =>
		typeof v === "string" && ISO_INSTANT.test(v)
			? toPracticeTime(new Date(v))
			: v,
	);
}

/** What the model is told about an action part, given its current status. */
export function actionModelContent(part: AiActionPart): string {
	const proposal = toModelJson(part.proposal);
	switch (part.status) {
		case "proposed":
			return `Shown to the doctor as a card to confirm or dismiss. Nothing has been done yet; do not say it is done. Proposal: ${proposal}${part.warnings.length ? ` Warnings shown: ${part.warnings.join(" ")}` : ""}`;
		case "confirmed":
			return `The doctor confirmed it${part.outcome ? `: ${part.outcome.label}` : ""}. Final values: ${proposal}`;
		case "dismissed":
			return "The doctor dismissed it. Nothing was done.";
		case "failed":
			return `Confirming it failed${part.error ? `: ${part.error}` : ""}. Nothing was done.`;
	}
}

type Prepared =
	/** A read tool to run; its part starts as `running`. */
	| { kind: "read"; part: AiToolPart; run: () => Promise<AiToolPart> }
	/** An action whose proposal is ready to show. */
	| { kind: "action"; part: AiActionPart }
	/** The call was wrong; only the model hears about it. */
	| { kind: "invalid"; message: string };

/**
 * Turns one model tool call into a part. Bad arguments and wrong ids go back
 * to the model as errors so it can fix them; the doctor never sees those.
 */
export async function prepareToolCall(
	ctx: ToolContext,
	call: ChatToolCall,
): Promise<Prepared> {
	let rawArgs: unknown;
	try {
		rawArgs = call.arguments ? JSON.parse(call.arguments) : {};
	} catch {
		return { kind: "invalid", message: "Arguments were not valid JSON." };
	}

	if (isReadTool(call.name)) {
		const parsed = readToolSchemas[call.name].input.safeParse(rawArgs);
		if (!parsed.success) {
			return { kind: "invalid", message: z.prettifyError(parsed.error) };
		}
		const tool = readTools[call.name] as {
			run: (ctx: ToolContext, args: unknown) => Promise<unknown>;
		};
		const running = {
			type: "tool",
			id: call.id,
			name: call.name,
			status: "running",
			args: parsed.data,
		} as AiToolPart;
		return {
			kind: "read",
			part: running,
			run: async () => {
				try {
					const result = await tool.run(ctx, parsed.data);
					return { ...running, status: "done", result } as AiToolPart;
				} catch (err) {
					if (!(err instanceof ToolError)) {
						console.error(`AI tool ${call.name} failed:`, err);
					}
					const error =
						err instanceof ToolError ? err.message : "The lookup failed.";
					return { ...running, status: "error", error } as AiToolPart;
				}
			},
		};
	}

	if (isActionTool(call.name)) {
		const parsed = actionToolSchemas[call.name].input.safeParse(rawArgs);
		if (!parsed.success) {
			return { kind: "invalid", message: z.prettifyError(parsed.error) };
		}
		const tool = actionTools[call.name] as {
			propose: (
				ctx: ToolContext,
				args: unknown,
			) => Promise<{ proposal: unknown; warnings: string[] }>;
		};
		try {
			const { proposal, warnings } = await tool.propose(ctx, parsed.data);
			return {
				kind: "action",
				part: {
					type: "action",
					id: call.id,
					name: call.name,
					status: "proposed",
					proposal,
					warnings,
				} as AiActionPart,
			};
		} catch (err) {
			if (err instanceof ToolError)
				return { kind: "invalid", message: err.message };
			throw err;
		}
	}

	return { kind: "invalid", message: `There is no tool named ${call.name}.` };
}
