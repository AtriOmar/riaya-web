"use client";

import { formatDistanceToNow } from "date-fns";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import ConfirmationDialog from "@/components/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/error-handling";
import { cn } from "@/lib/utils";
import {
	deleteApiAiChatConversationsId,
	useGetApiAiChatConversations,
} from "@/services/generated/ai-chat/ai-chat";

/** The doctor's AI conversations, newest first, with New chat and delete. */
export function ConversationList({
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
		<div className="flex h-full w-full flex-col">
			<div className="shrink-0 p-3">
				<Button
					variant="outline"
					className="h-10 w-full justify-start gap-2 rounded-xl bg-background shadow-xs"
					onClick={onNew}
				>
					<Plus className="size-4" />
					New chat
				</Button>
			</div>

			<p className="px-5 pb-1.5 font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
				Recent
			</p>

			<div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
				{isLoading && (
					<div className="flex justify-center py-10">
						<Loader2 className="size-5 animate-spin text-muted-foreground" />
					</div>
				)}

				{!isLoading && conversations.length === 0 && (
					<p className="px-3 py-6 text-center text-muted-foreground text-xs leading-relaxed">
						Your conversations will show up here.
					</p>
				)}

				{!isLoading &&
					conversations.map((c) => {
						const isActive = activeId === c.id;
						return (
							<div
								key={c.id}
								className={cn(
									"group relative flex items-center rounded-lg transition-colors",
									isActive
										? "bg-background shadow-xs ring-1 ring-border"
										: "hover:bg-background/70",
								)}
							>
								<button
									type="button"
									className="min-w-0 flex-1 py-2 pr-9 pl-3 text-left"
									onClick={() => onSelect(c.id)}
								>
									<p
										className={cn(
											"truncate text-sm",
											isActive ? "font-medium" : "text-foreground/90",
										)}
									>
										{c.title ?? "Untitled"}
									</p>
									{c.updatedAt && (
										<p className="mt-0.5 text-[11px] text-muted-foreground">
											{formatDistanceToNow(new Date(c.updatedAt), {
												addSuffix: true,
											})}
										</p>
									)}
								</button>
								<button
									type="button"
									className="absolute right-1.5 rounded-md p-1.5 text-muted-foreground opacity-70 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
									onClick={(e) => {
										e.stopPropagation();
										setDeleteId(c.id);
									}}
									aria-label="Delete conversation"
								>
									<Trash2 className="size-3.5" />
								</button>
							</div>
						);
					})}
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
