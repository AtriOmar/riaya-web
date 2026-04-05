"use client";

import { Phone } from "lucide-react";
import useRealtimeSocket from "@/hooks/use-realtime-socket";
import CallCard from "./call-card";

export default function LiveCalls() {
	const {
		calls,
		isConnected,
		listeningCalls,
		toggleListening,
		audioCallbackRef,
	} = useRealtimeSocket();

	const callList = Array.from(calls.values()).sort((a, b) => {
		if (a.status === "active" && b.status !== "active") return -1;
		if (a.status !== "active" && b.status === "active") return 1;
		return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
	});

	return (
		<div className="p-6">
			{/* Header */}
			<div className="flex justify-between items-center mb-6">
				<div>
					<h1 className="font-bold text-2xl">Live Calls</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Monitor ongoing patient calls in real-time
					</p>
				</div>
				<div className="flex items-center gap-2">
					<div
						className={`w-2.5 h-2.5 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
					/>
					<span className="text-muted-foreground text-sm">
						{isConnected ? "Connected" : "Disconnected"}
					</span>
				</div>
			</div>

			{/* Call list */}
			{callList.length === 0 ? (
				<div className="flex flex-col justify-center items-center py-20 text-muted-foreground">
					<Phone className="size-16 mb-4 stroke-1" />
					<p className="font-medium text-lg">No active calls</p>
					<p className="mt-1 text-sm">
						Calls will appear here when patients call in
					</p>
				</div>
			) : (
				<div className="space-y-4">
					{callList.map((call) => (
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
