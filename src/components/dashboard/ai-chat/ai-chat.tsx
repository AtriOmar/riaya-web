"use client";

import { PanelLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ChatHeader } from "./chat-header";
import { ChatThread } from "./chat-thread";
import { ConversationList } from "./conversation-list";
import { useAiChat } from "./use-ai-chat";

/** The AI Assistant page: conversation list on the left, the chat on the right. */
export default function AiChat() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [showMobileList, setShowMobileList] = useState(false);

	const chat = useAiChat({
		preloadRecordingId: searchParams.get("transcript"),
		onPreloadCleared: useCallback(
			() => router.replace("/dashboard/ai-chat"),
			[router],
		),
	});

	const select = (id: number) => {
		chat.selectConversation(id);
		setShowMobileList(false);
	};
	const startNew = () => {
		chat.startNewChat();
		setShowMobileList(false);
	};

	return (
		<div className="flex h-[calc(100dvh-9rem)] overflow-hidden rounded-2xl border bg-card shadow-sm">
			<aside className="hidden h-full w-64 shrink-0 border-r bg-muted/40 md:flex lg:w-72">
				<ConversationList
					activeId={chat.conversationId}
					onSelect={select}
					onNew={startNew}
				/>
			</aside>

			<Sheet open={showMobileList} onOpenChange={setShowMobileList}>
				<SheetContent
					side="left"
					className="w-80 gap-0 p-0 sm:max-w-80"
					// Picking a conversation focuses the composer; don't take it back
					onCloseAutoFocus={(e) => e.preventDefault()}
				>
					<SheetTitle className="sr-only">Conversations</SheetTitle>
					<ConversationList
						activeId={chat.conversationId}
						onSelect={select}
						onNew={startNew}
					/>
				</SheetContent>
			</Sheet>

			<div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
				<ChatHeader chat={chat}>
					<Button
						variant="ghost"
						size="icon-sm"
						className="-ml-1 md:hidden"
						onClick={() => setShowMobileList(true)}
						aria-label="Open conversations"
					>
						<PanelLeft className="size-4" />
					</Button>
				</ChatHeader>
				<ChatThread chat={chat} />
			</div>
		</div>
	);
}
