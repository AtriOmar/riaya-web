"use client";

import { Loader2, Phone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

	const { activeCount, filtered } = useMemo(() => {
		const list = Array.from(calls.values()).sort((a, b) => {
			if (a.status === "active" && b.status !== "active") return -1;
			if (a.status !== "active" && b.status === "active") return 1;
			return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
		});
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
				<div className="grid min-h-[min(72vh,640px)] gap-4 lg:grid-cols-[minmax(240px,32%)_1fr] lg:items-stretch">
					<aside className="flex min-h-0 flex-col gap-2 lg:max-h-[min(85vh,920px)] lg:overflow-y-auto lg:pr-1">
						{filtered.map((call) => (
							<CallListItem
								key={call.callSid}
								call={call}
								selected={selectedCallSid === call.callSid}
								onSelect={() => setSelectedCallSid(call.callSid)}
							/>
						))}
					</aside>
					<section className="flex h-full min-h-[320px] min-w-0 flex-col lg:min-h-0">
						{selectedCall ? (
							<CallCard
								call={selectedCall}
								isListening={listeningCalls.has(selectedCall.callSid)}
								onToggleListening={() => toggleListening(selectedCall.callSid)}
								audioCallbackRef={audioCallbackRef}
							/>
						) : (
							<div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center text-muted-foreground">
								<Phone className="mb-3 size-12 stroke-1 opacity-40" />
								<p className="font-medium text-foreground text-sm">
									Select a call
								</p>
								<p className="mt-1 max-w-sm text-sm">
									Choose a call from the list to view the transcript, recording,
									and live audio.
								</p>
							</div>
						)}
					</section>
				</div>
			)}
		</div>
	);
}
