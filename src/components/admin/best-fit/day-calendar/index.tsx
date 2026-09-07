"use client";

import { ArrowLeft, CalendarX, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { CubeLoader } from "@/components/loaders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BestFitRangeDoctor } from "@/hooks/use-best-fit-range";
import {
	buildTimeRows,
	fmtMinutes,
	formatFullDate,
	toTimeKey,
} from "../shared/helpers";
import { INITIAL_VISIBLE, LOAD_MORE_STEP } from "./constants";
import TimeSlotRow from "./time-slot-row";

type Props = {
	date: Date;
	doctors: BestFitRangeDoctor[];
	isLoading?: boolean;
	onBack: () => void;
	onNavigateDay: (date: Date) => void;
	onSelectDoctor: (doctorId: number, date: Date) => void;
};

export default function DayCalendar({
	date,
	doctors,
	isLoading,
	onBack,
	onNavigateDay,
	onSelectDoctor,
}: Props) {
	const [visibleByTime, setVisibleByTime] = useState<Record<string, number>>(
		{},
	);

	const slotMap = useMemo(() => {
		const map = new Map<string, BestFitRangeDoctor[]>();
		for (const doctor of doctors) {
			for (const slot of doctor.slots) {
				const key = toTimeKey(new Date(slot.start));
				const existing = map.get(key);
				if (existing) existing.push(doctor);
				else map.set(key, [doctor]);
			}
		}
		return map;
	}, [doctors]);

	const timeRows = useMemo(() => {
		let min: number | null = null;
		let max: number | null = null;
		for (const doctor of doctors) {
			for (const slot of doctor.slots) {
				const s = new Date(slot.start);
				const e = new Date(slot.end);
				const sm = s.getHours() * 60 + s.getMinutes();
				const em = e.getHours() * 60 + e.getMinutes();
				if (min === null || sm < min) min = sm;
				if (max === null || em > max) max = em;
			}
		}
		return buildTimeRows(min, max);
	}, [doctors]);

	function goToPrev() {
		const d = new Date(date);
		d.setDate(d.getDate() - 1);
		setVisibleByTime({});
		onNavigateDay(d);
	}
	function goToNext() {
		const d = new Date(date);
		d.setDate(d.getDate() + 1);
		setVisibleByTime({});
		onNavigateDay(d);
	}

	function showMore(timeKey: string, total: number) {
		setVisibleByTime((prev) => {
			const current = prev[timeKey] ?? INITIAL_VISIBLE;
			return {
				...prev,
				[timeKey]: Math.min(current + LOAD_MORE_STEP, total),
			};
		});
	}

	const isToday = date.toDateString() === new Date().toDateString();

	return (
		<div className="relative mt-4">
			{isLoading && (
				<div className="z-10 absolute inset-0 flex justify-center items-center bg-background/60 rounded-xl backdrop-blur-sm">
					<CubeLoader />
				</div>
			)}

			<div className="border rounded-xl overflow-hidden bg-card shadow-sm">
				<div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b bg-card/80">
					<div className="flex items-center gap-2">
						<Button variant="quiet" size="sm" onClick={onBack}>
							<ArrowLeft className="size-4" />
							Week
						</Button>
						<div className="flex items-center gap-1">
							<Button
								variant="ghost"
								size="icon"
								className="size-7"
								onClick={goToPrev}
							>
								<ChevronLeft className="size-4" />
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
					</div>

					<div className="flex flex-col items-center gap-1 sm:flex-row sm:gap-3">
						<span className="font-semibold text-sm text-foreground">
							{formatFullDate(date)}
							{isToday ? (
								<span className="ml-2 text-primary font-medium text-xs">
									Today
								</span>
							) : null}
						</span>
						<div className="inline-flex items-center gap-2 text-muted-foreground text-xs">
							<span>
								{doctors.length} doctor{doctors.length === 1 ? "" : "s"}
							</span>
							{doctors.length > 0 && (
								<Badge variant="secondary">Sorted by best fit</Badge>
							)}
						</div>
					</div>

					<div className="hidden sm:block w-[88px]" />
				</div>

				{doctors.length === 0 && !isLoading ? (
					<div className="flex flex-col justify-center items-center py-20 text-muted-foreground text-center">
						<CalendarX className="opacity-40 mb-3 w-12 h-12" />
						<p className="font-semibold text-foreground">
							No doctors available on this day
						</p>
						<p className="mt-1 text-sm">
							Try another day or adjust your filters.
						</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						{timeRows.map((minutes) => {
							const timeKey = fmtMinutes(minutes);
							const slotDoctors = slotMap.get(timeKey) ?? [];
							const visibleCount = visibleByTime[timeKey] ?? INITIAL_VISIBLE;
							return (
								<TimeSlotRow
									key={minutes}
									minutes={minutes}
									doctors={slotDoctors}
									date={date}
									visibleCount={visibleCount}
									onShowMore={() => showMore(timeKey, slotDoctors.length)}
									onSelectDoctor={onSelectDoctor}
								/>
							);
						})}
					</div>
				)}
			</div>

			<p className="mt-2 text-muted-foreground text-xs">
				Click a doctor to open their full schedule · Use +N more to load
				additional doctors in a time slot.
			</p>
		</div>
	);
}
