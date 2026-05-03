"use client";

import { Loader2, Phone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import useRealtimeSocket from "@/hooks/use-realtime-socket";
import CallCard from "./call-card";
import CallListItem from "./call-list-item";

type Filter = "all" | "active" | "ended";

export default function LiveCalls() {
	const {
		calls,
		isConnected,
		isLoadingCalls,
		listeningCalls,
		toggleListening,
		audioCallbackRef,
	} = useRealtimeSocket();

	const [filter, setFilter] = useState<Filter>("all");
	const [selectedCallSid, setSelectedCallSid] = useState<string | null>(null);
	const [detailsOpen, setDetailsOpen] = useState(false);

	const { activeCount, filtered } = useMemo(() => {
		const list = Array.from(calls.values()).sort(
			(a, b) =>
				new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
		);
		const active = list.filter((c) => c.status === "active");
		const ended = list.filter((c) => c.status === "ended");
		const filteredList =
			filter === "active" ? active : filter === "ended" ? ended : list;
		return {
			activeCount: active.length,
			filtered: filteredList,
		};
	}, [calls, filter]);

	const selectedCall = useMemo(() => {
		if (!selectedCallSid) return undefined;
		return (
			calls.get(selectedCallSid) ??
			filtered.find((c) => c.callSid === selectedCallSid)
		);
	}, [calls, filtered, selectedCallSid]);

	useEffect(() => {
		setSelectedCallSid((sid) =>
			sid && filtered.some((c) => c.callSid === sid) ? sid : null,
		);
	}, [filtered]);

	useEffect(() => {
		if (!selectedCallSid) setDetailsOpen(false);
	}, [selectedCallSid]);

	return (
		<div className="">
			<div className="flex items-center gap-4 mb-2">
				<div className="flex w-fit gap-1 rounded-lg bg-muted p-1">
					{(["all", "active", "ended"] as Filter[]).map((key) => (
						<button
							key={key}
							type="button"
							onClick={() => setFilter(key)}
							className={`rounded-md px-3 py-1.5 font-medium text-sm capitalize transition-colors ${
								filter === key
									? "bg-background shadow-sm"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							{key}
							{key === "active" && activeCount > 0 && (
								<span className="ml-1.5 text-primary text-xs">
									({activeCount})
								</span>
							)}
						</button>
					))}
				</div>

				<div className="flex items-center gap-2">
					<div
						className={`h-2.5 w-2.5 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
					/>
					<span className="text-muted-foreground text-sm">
						{isConnected ? "Live" : "Disconnected"}
					</span>
				</div>
			</div>

			{isLoadingCalls && calls.size === 0 ? (
				<div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
					<Loader2 className="mb-4 size-10 animate-spin" />
					<p className="text-sm">Loading calls...</p>
				</div>
			) : filtered.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
					<Phone className="mb-4 size-16 stroke-1" />
					<p className="font-medium text-lg">
						{filter === "active"
							? "No active calls"
							: filter === "ended"
								? "No past calls"
								: "No calls yet"}
					</p>
					<p className="mt-1 text-sm">
						Calls will appear here when patients call in
					</p>
				</div>
			) : (
				<>
					<div className="w-full max-w-full lg:max-w-[500px]">
						<aside className="flex min-h-[min(72vh,640px)] flex-col gap-2 overflow-y-auto lg:min-h-[calc(100dvh-9rem)]">
							{filtered.map((call) => (
								<CallListItem
									key={call.callSid}
									call={call}
									selected={selectedCallSid === call.callSid}
									onSelect={() => {
										setSelectedCallSid(call.callSid);
										setDetailsOpen(true);
									}}
								/>
							))}
						</aside>
					</div>

					<Sheet
						modal={false}
						open={detailsOpen && Boolean(selectedCall)}
						onOpenChange={setDetailsOpen}
					>
						<SheetContent
							side="right"
							showCloseButton
							className="overflow-visible gap-0 border-l border-border p-0 !w-[min(100vw,600px)] !max-w-[min(100vw,600px)]"
							onPointerDownOutside={(e) => e.preventDefault()}
							onFocusOutside={(e) => e.preventDefault()}
						>
							<SheetTitle className="sr-only">Call details</SheetTitle>
							{/* <SheetClose asChild>
								<Button
									type="button"
									variant="secondary"
									size="icon"
									className="absolute top-1/2 left-0 z-20 h-30 w-7 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-border bg-background p-0 shadow- hover:bg-muted"
									aria-label="Collapse panel"
								>
									<ArrowRightToLine className="size-5" />
								</Button>
							</SheetClose> */}
							{selectedCall ? (
								<div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden pt-12">
									<CallCard
										variant="drawer"
										call={selectedCall}
										isListening={listeningCalls.has(selectedCall.callSid)}
										onToggleListening={() =>
											toggleListening(selectedCall.callSid)
										}
										audioCallbackRef={audioCallbackRef}
									/>
								</div>
							) : null}
						</SheetContent>
					</Sheet>
				</>
			)}
		</div>
	);
}
