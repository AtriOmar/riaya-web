"use client";

import { Loader2, Phone } from "lucide-react";
import { useMemo, useState } from "react";
import useRealtimeSocket from "@/hooks/use-realtime-socket";
import CallCard from "./call-card";

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

	const { activeCount, endedCount, filtered } = useMemo(() => {
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
			endedCount: ended.length,
			filtered: filteredList,
		};
	}, [calls, filter]);

	return (
		<div className="">
			<div className="flex items-center gap-2">
				<div
					className={`w-2.5 h-2.5 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
				/>
				<span className="text-muted-foreground text-sm">
					{isConnected ? "Live" : "Disconnected"}
				</span>
			</div>

			{/* Filter tabs */}
			<div className="flex gap-1 w-fit mb-4 p-1 rounded-lg bg-muted">
				{(["all", "active", "ended"] as Filter[]).map((key) => (
					<button
						key={key}
						type="button"
						onClick={() => setFilter(key)}
						className={`px-3 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${
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

			{/* Body */}
			{isLoadingCalls && calls.size === 0 ? (
				<div className="flex flex-col justify-center items-center py-20 text-muted-foreground">
					<Loader2 className="size-10 mb-4 animate-spin" />
					<p className="text-sm">Loading calls...</p>
				</div>
			) : filtered.length === 0 ? (
				<div className="flex flex-col justify-center items-center py-20 text-muted-foreground">
					<Phone className="size-16 mb-4 stroke-1" />
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
				<div className="space-y-4">
					{filtered.map((call) => (
						<CallCard
							key={call.callSid}
							call={call}
							isListening={listeningCalls.has(call.callSid)}
							onToggleListening={() => toggleListening(call.callSid)}
							audioCallbackRef={audioCallbackRef}
						/>
					))}
				</div>
			)}
		</div>
	);
}
