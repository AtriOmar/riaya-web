"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { CubeLoader } from "@/components/loaders";
import { Button } from "@/components/ui/button";
import type { AdminDoctorAppointment } from "@/hooks/use-admin-doctor";
import { cn } from "@/lib/utils";
import type { Availability } from "@/services/types";
import {
	buildTimeRows,
	formatWeekLabel,
	getWeekDays,
	toDateKey,
} from "../shared/helpers";
import { TIME_GUTTER_W } from "./constants";
import DayHeader from "./day-header";
import GridCell from "./grid-cell";
import {
	appointmentsStartingIn,
	buildAvailabilityByDay,
	isAvailableAt,
	isBusySlot,
} from "./helpers";
import TimeGutter from "./time-gutter";

type Props = {
	initialDate?: Date;
	availability: Availability | null | undefined;
	appointments: AdminDoctorAppointment[];
	isLoading?: boolean;
};

export default function DoctorAvailabilityCalendar({
	initialDate,
	availability,
	appointments,
	isLoading,
}: Props) {
	const [currentDate, setCurrentDate] = useState<Date>(
		() => initialDate ?? new Date(),
	);

	const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
	const todayKey = toDateKey(new Date());

	const availabilityByDay = useMemo(
		() => buildAvailabilityByDay(availability),
		[availability],
	);

	const activeAppointments = useMemo(
		() =>
			appointments.filter((a) => a.start && a.end && a.status !== "cancelled"),
		[appointments],
	);

	const apptCountByDate = useMemo(() => {
		const map = new Map<string, number>();
		for (const a of activeAppointments) {
			if (!a.start) continue;
			const key = toDateKey(new Date(a.start));
			map.set(key, (map.get(key) ?? 0) + 1);
		}
		return map;
	}, [activeAppointments]);

	const timeRows = useMemo(() => {
		let min: number | null = null;
		let max: number | null = null;

		for (const ranges of Object.values(availabilityByDay)) {
			for (const s of ranges) {
				if (min === null || s.start < min) min = s.start;
				if (max === null || s.end > max) max = s.end;
			}
		}

		for (const a of activeAppointments) {
			if (!a.start || !a.end) continue;
			const s = new Date(a.start);
			const e = new Date(a.end);
			const sm = s.getHours() * 60 + s.getMinutes();
			const em = e.getHours() * 60 + e.getMinutes();
			if (min === null || sm < min) min = sm;
			if (max === null || em > max) max = em;
		}

		return buildTimeRows(min, max);
	}, [availabilityByDay, activeAppointments]);

	function goToPrev() {
		const d = new Date(currentDate);
		d.setDate(d.getDate() - 7);
		setCurrentDate(d);
	}
	function goToNext() {
		const d = new Date(currentDate);
		d.setDate(d.getDate() + 7);
		setCurrentDate(d);
	}
	function goToToday() {
		setCurrentDate(new Date());
	}

	const weekLabel = useMemo(() => formatWeekLabel(weekDays), [weekDays]);
	const gridCols = `${TIME_GUTTER_W}px repeat(7, 1fr)`;

	return (
		<div className="relative mt-4">
			{isLoading && (
				<div className="z-10 absolute inset-0 flex justify-center items-center bg-background/60 rounded-xl backdrop-blur-sm">
					<CubeLoader />
				</div>
			)}

			<div className="border rounded-xl overflow-hidden bg-card shadow-sm">
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
							<span className="inline-block size-3 rounded-sm bg-green-500/20 border border-green-500/40" />
							Available
						</span>
						<span className="flex items-center gap-1.5">
							<span className="inline-block size-3 rounded-sm bg-primary" />
							Confirmed
						</span>
						<span className="flex items-center gap-1.5">
							<span className="inline-block size-3 rounded-sm bg-yellow-600" />
							Pending
						</span>
					</div>
				</div>

				<div className="overflow-x-auto">
					<div style={{ minWidth: 580 }}>
						<div
							className="grid sticky top-0 z-10 bg-card"
							style={{ gridTemplateColumns: gridCols }}
						>
							<div
								className="border-b border-r border-border bg-muted/20"
								style={{ width: TIME_GUTTER_W }}
							/>
							{weekDays.map((day) => {
								const key = toDateKey(day);
								return (
									<DayHeader
										key={key}
										day={day}
										isToday={key === todayKey}
										apptCount={apptCountByDate.get(key) ?? 0}
									/>
								);
							})}
						</div>

						{timeRows.length === 0 ? (
							<div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
								No availability configured for this doctor.
							</div>
						) : (
							timeRows.map((minutes) => {
								const isHour = minutes % 60 === 0;
								return (
									<div
										key={minutes}
										className={cn(
											"grid",
											isHour && "border-t border-border/30",
										)}
										style={{ gridTemplateColumns: gridCols }}
									>
										<TimeGutter minutes={minutes} />
										{weekDays.map((day) => {
											const dayKey = toDateKey(day);
											return (
												<GridCell
													key={dayKey}
													minutes={minutes}
													isToday={dayKey === todayKey}
													available={isAvailableAt(
														day,
														minutes,
														availabilityByDay,
													)}
													appointments={appointmentsStartingIn(
														day,
														minutes,
														activeAppointments,
													)}
													busy={isBusySlot(day, minutes, activeAppointments)}
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
		</div>
	);
}
