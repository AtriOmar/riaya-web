"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CubeLoader } from "@/components/loaders";
import { Button } from "@/components/ui/button";
import type {
	BestFitRangeDay,
	BestFitRangeDoctor,
} from "@/hooks/use-best-fit-range";
import { cn } from "@/lib/utils";
import {
	buildTimeRows,
	fmtMinutes,
	formatWeekLabel,
	getWeekDays,
	toDateKey,
	toTimeKey,
} from "../shared/helpers";
import { TIME_GUTTER_W } from "./constants";
import DayHeader from "./day-header";
import GridCell from "./grid-cell";
import TimeGutter from "./time-gutter";

type Props = {
	data: BestFitRangeDay[] | undefined;
	isLoading: boolean;
	filtersReady: boolean;
	currentDate: Date;
	onNavigate: (date: Date) => void;
	onSelectDate: (date: Date) => void;
	onSelectDoctor: (doctorId: number, date: Date) => void;
};

export default function BestFitCalendar({
	data,
	isLoading,
	filtersReady,
	currentDate,
	onNavigate,
	onSelectDate,
	onSelectDoctor,
}: Props) {
	const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
	const weekStartKey = weekDays[0] ? toDateKey(weekDays[0]) : "";
	const todayKey = toDateKey(new Date());
	const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null);

	useEffect(() => {
		setExpandedDayKey(null);
	}, [weekStartKey]);

	const slotMap = useMemo(() => {
		const map = new Map<string, Map<string, BestFitRangeDoctor[]>>();
		for (const day of data ?? []) {
			const dayMap = new Map<string, BestFitRangeDoctor[]>();
			map.set(day.date, dayMap);
			for (const doctor of day.doctors) {
				for (const slot of doctor.slots) {
					const key = toTimeKey(new Date(slot.start));
					const existing = dayMap.get(key);
					if (existing) existing.push(doctor);
					else dayMap.set(key, [doctor]);
				}
			}
		}
		return map;
	}, [data]);

	const countsByDate = useMemo(() => {
		const map = new Map<string, number>();
		for (const day of data ?? []) map.set(day.date, day.doctors.length);
		return map;
	}, [data]);

	const timeRows = useMemo(() => {
		let min: number | null = null;
		let max: number | null = null;
		for (const day of data ?? []) {
			for (const doctor of day.doctors) {
				for (const slot of doctor.slots) {
					const s = new Date(slot.start);
					const e = new Date(slot.end);
					const sm = s.getHours() * 60 + s.getMinutes();
					const em = e.getHours() * 60 + e.getMinutes();
					if (min === null || sm < min) min = sm;
					if (max === null || em > max) max = em;
				}
			}
		}
		return buildTimeRows(min, max);
	}, [data]);

	function goToPrev() {
		const d = new Date(currentDate);
		d.setDate(d.getDate() - 7);
		onNavigate(d);
	}
	function goToNext() {
		const d = new Date(currentDate);
		d.setDate(d.getDate() + 7);
		onNavigate(d);
	}
	function goToToday() {
		onNavigate(new Date());
	}

	const weekLabel = useMemo(() => formatWeekLabel(weekDays), [weekDays]);

	const gridCols = useMemo(() => {
		const dayCols = weekDays
			.map((day) => (toDateKey(day) === expandedDayKey ? "2fr" : "1fr"))
			.join(" ");
		return `${TIME_GUTTER_W}px ${dayCols}`;
	}, [weekDays, expandedDayKey]);

	return (
		<div className="relative mt-4">
			{isLoading && (
				<div className="z-10 absolute inset-0 flex justify-center items-center bg-background/60 rounded-xl backdrop-blur-sm">
					<CubeLoader />
				</div>
			)}

			{!filtersReady && !isLoading && (
				<div className="z-10 absolute inset-0 flex flex-col justify-center items-center bg-background/80 rounded-xl backdrop-blur-sm gap-2 text-muted-foreground text-sm min-h-[300px]">
					<span className="text-2xl">🗓️</span>
					<p>Pick a speciality and a location to load the calendar.</p>
				</div>
			)}

			<div
				className={cn(
					"border rounded-xl overflow-hidden bg-card shadow-sm",
					!filtersReady && "min-h-[300px]",
				)}
			>
				<div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b bg-card/80">
					<div className="flex items-center gap-1.5">
						<Button
							variant="ghost"
							size="icon"
							className="size-7"
							onClick={goToPrev}
						>
							<ChevronLeft className="size-4" />
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="h-7 px-2.5 text-xs"
							onClick={goToToday}
						>
							Today
						</Button>
						<Button
							variant="ghost"
							size="icon"
							className="size-7"
							onClick={goToNext}
						>
							<ChevronRight className="size-4" />
						</Button>
					</div>

					<span className="font-semibold text-sm text-foreground">
						{weekLabel}
					</span>

					<div className="hidden sm:flex items-center gap-3 text-[11px] text-muted-foreground">
						<span className="flex items-center gap-1.5">
							<span className="inline-block size-3 rounded-sm bg-primary/15 border border-primary/25" />
							Available
						</span>
						<span className="flex items-center gap-1.5">
							<span className="inline-block size-3 rounded-sm bg-green-500/20 border border-green-500/25" />
							Many options
						</span>
					</div>
				</div>

				<div className="overflow-x-auto">
					<div
						style={{
							minWidth: expandedDayKey ? 720 : 580,
							transition: "min-width 200ms ease",
						}}
					>
						<div
							className="grid sticky top-0 z-10 bg-card transition-[grid-template-columns] duration-200"
							style={{ gridTemplateColumns: gridCols }}
						>
							<div
								className="border-b border-r border-border bg-muted/20"
								style={{ width: TIME_GUTTER_W }}
							/>
							{weekDays.map((day) => {
								const key = toDateKey(day);
								const expanded = key === expandedDayKey;
								return (
									<DayHeader
										key={key}
										day={day}
										count={countsByDate.get(key) ?? 0}
										isToday={key === todayKey}
										expanded={expanded}
										onClick={() => onSelectDate(day)}
										onToggleExpand={() =>
											setExpandedDayKey(expanded ? null : key)
										}
									/>
								);
							})}
						</div>

						{timeRows.length === 0 && filtersReady && !isLoading ? (
							<div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
								No doctors available this week.
							</div>
						) : (
							timeRows.map((minutes) => {
								const isHour = minutes % 60 === 0;
								return (
									<div
										key={minutes}
										className={cn(
											"grid transition-[grid-template-columns] duration-200",
											isHour && "border-t border-border/30",
										)}
										style={{ gridTemplateColumns: gridCols }}
									>
										<TimeGutter minutes={minutes} />
										{weekDays.map((day) => {
											const dayKey = toDateKey(day);
											const timeKey = fmtMinutes(minutes);
											const doctors = slotMap.get(dayKey)?.get(timeKey) ?? [];
											const expanded = dayKey === expandedDayKey;
											return (
												<GridCell
													key={dayKey}
													doctors={doctors}
													day={day}
													isToday={dayKey === todayKey}
													expanded={expanded}
													onSelectDate={onSelectDate}
													onSelectDoctor={onSelectDoctor}
												/>
											);
										})}
									</div>
								);
							})
						)}
					</div>
				</div>
			</div>

			{filtersReady && !isLoading && (
				<p className="mt-2 text-muted-foreground text-xs">
					Click any day or time cell to open the full day calendar · Click a
					doctor chip to view their full schedule · Expand a day to see more
					doctors per time box.
				</p>
			)}
		</div>
	);
}
