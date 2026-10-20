"use client";

import { Streamdown } from "streamdown";
import type { AiActionPart, AiChatPart } from "@/lib/ai-chat-parts";
import { ActionPartView } from "./action-cards";
import { ToolPartView } from "./tool-cards";

/** An assistant reply: its text, the cards for what it looked up, and its proposals. */
export function MessageParts({
	parts,
	messageId,
	live,
	onActionChange,
}: {
	parts: AiChatPart[];
	messageId: number | null;
	live: boolean;
	onActionChange: (part: AiActionPart) => void;
}) {
	return (
		<>
			{parts.map((part, index) => {
				const key = part.type === "text" ? `text-${index}` : part.id;
				if (part.type === "text") {
					return (
						<Streamdown
							key={key}
							dir="auto"
							isAnimating={live && index === parts.length - 1}
							caret="block"
							lineNumbers={false}
							controls={{ table: false }}
							tableMaxHeight={480}
							className="chat-markdown"
						>
							{part.text}
						</Streamdown>
					);
				}
				if (part.type === "tool") return <ToolPartView key={key} part={part} />;
				return (
					<ActionPartView
						key={key}
						part={part}
						messageId={messageId}
						locked={live || messageId == null}
						onChange={onActionChange}
					/>
				);
			})}
		</>
	);
}
