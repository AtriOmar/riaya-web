"use client";

import {
	ArrowUpDown,
	CalendarClock,
	ListFilter,
	Loader2,
	Phone,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	FilterSearch,
	FilterSegmented,
	FilterSelect,
} from "@/components/ui/filter-controls";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import useRealtimeSocket, { type CallData } from "@/hooks/use-realtime-socket";
import CallCard from "./call-card";
import CallListItem from "./call-list-item";

type Filter = "all" | "active" | "ended";

const DAY_MS = 24 * 60 * 60 * 1000;

const RANGE_OPTIONS = [
	{ value: "all", label: "All time" },
	{ value: "1", label: "Last 24 hours" },
	{ value: "7", label: "Last 7 days" },
	{ value: "30", label: "Last 30 days" },
];

const OUTCOME_OPTIONS = [
	{ value: "all", label: "All outcomes" },
	{ value: "booked", label: "Booked an appointment", dot: "bg-green-500" },
	{ value: "errors", label: "Had errors", dot: "bg-red-500" },
	{ value: "recorded", label: "Has recording" },
];

const SORT_OPTIONS = [
	{ value: "newest", label: "Newest first" },
	{ value: "oldest", label: "Oldest first" },
	{ value: "longest", label: "Longest first" },
	{ value: "shortest", label: "Shortest first" },
];

function matchesOutcome(call: CallData, outcome: string) {
	switch (outcome) {
		case "booked":
			return call.timeline.some(
				(e) =>
					e.kind === "function_call" &&
					e.name === "book_appointment" &&
					e.status === "success",
			);
		case "errors":
			return call.timeline.some((e) => e.kind === "error");
		case "recorded":
			return Boolean(call.recordingUrl);
		default:
			return true;
	}
}

/** Ended calls use their saved length; live ones count up to now. */
function callSeconds(call: CallData) {
	if (call.duration != null) return call.duration;
	const end = call.endTime ? new Date(call.endTime).getTime() : Date.now();
	return Math.max(0, (end - new Date(call.startTime).getTime()) / 1000);
}

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
	const [search, setSearch] = useState("");
	const [outcome, setOutcome] = useState("all");
	const [range, setRange] = useState("all");
	const [sort, setSort] = useState("newest");
	const [selectedCallSid, setSelectedCallSid] = useState<string | null>(null);
	const [detailsOpen, setDetailsOpen] = useState(false);

	const { activeCount, filtered } = useMemo(() => {
		const all = Array.from(calls.values());
		const q = search.trim().toLowerCase();
		const since = range === "all" ? 0 : Date.now() - Number(range) * DAY_MS;
		const list = all
			.filter((c) => {
				if (filter === "active" && c.status !== "active") return false;
				if (filter === "ended" && c.status !== "ended") return false;
				if (since && new Date(c.startTime).getTime() < since) return false;
				if (!matchesOutcome(c, outcome)) return false;
				if (!q) return true;
				return [c.callerName, c.from].some((v) => v?.toLowerCase().includes(q));
			})
			.sort((a, b) => {
				const aStart = new Date(a.startTime).getTime();
				const bStart = new Date(b.startTime).getTime();
				switch (sort) {
					case "oldest":
						return aStart - bStart;
					case "longest":
						return callSeconds(b) - callSeconds(a);
					case "shortest":
						return callSeconds(a) - callSeconds(b);
					default:
						return bStart - aStart;
				}
			});
		return {
			activeCount: all.filter((c) => c.status === "active").length,
			filtered: list,
		};
	}, [calls, filter, search, outcome, range, sort]);

	const hasFilters =
		filter !== "all" ||
		search.trim() !== "" ||
		outcome !== "all" ||
		range !== "all";

	function clearFilters() {
		setFilter("all");
		setSearch("");
		setOutcome("all");
		setRange("all");
	}

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
			<div className="mb-4 flex flex-wrap items-center gap-2">
				<FilterSearch
					value={search}
					onChange={setSearch}
					placeholder="Search by caller or number..."
				/>
				<FilterSegmented
					value={filter}
					onChange={setFilter}
					options={(["all", "active", "ended"] as Filter[]).map((key) => ({
						value: key,
						label: (
							<>
								{key}
								{key === "active" && activeCount > 0 && (
									<span className="text-primary text-xs">({activeCount})</span>
								)}
							</>
						),
					}))}
				/>

				<FilterSelect
					icon={ListFilter}
					label="Filter by outcome"
					value={outcome}
					onValueChange={setOutcome}
					options={OUTCOME_OPTIONS}
				/>
				<FilterSelect
					icon={CalendarClock}
					label="Filter by date"
					value={range}
					onValueChange={setRange}
					options={RANGE_OPTIONS}
				/>
				<FilterSelect
					icon={ArrowUpDown}
					label="Sort by"
					value={sort}
					onValueChange={setSort}
					options={SORT_OPTIONS}
				/>

				<div className="flex items-center gap-2 sm:ml-auto">
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
						{hasFilters ? "No calls match your filters" : "No calls yet"}
					</p>
					<p className="mt-1 text-sm">
						{hasFilters
							? "Try different filters or a wider date range"
							: "Calls will appear here when patients call in"}
					</p>
					{hasFilters && (
						<Button
							variant="outline"
							size="sm"
							className="mt-4"
							onClick={clearFilters}
						>
							Clear filters
						</Button>
					)}
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
								<div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden pt-4">
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
