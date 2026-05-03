"use client";

import moment from "moment";
import {
	type ComponentType,
	type CSSProperties,
	cloneElement,
	useCallback,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	Calendar as BigCalendar,
	momentLocalizer,
	type View,
} from "react-big-calendar";
import type { EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import { toast } from "sonner";
import useSWR from "swr";
import { CubeLoader } from "@/components/loaders";
import { getAppointments, getMe, updateAppointment } from "@/services";
import type { AppointmentWithPatient, Availability } from "@/services/types";
import AddAppointmentModal from "./add-appointment-modal";
import EditAppointmentModal, {
	type CalendarEvent,
} from "./edit-appointment-modal";

const localizer = momentLocalizer(moment);
const DnDCalendar = withDragAndDrop<CalendarEvent>(BigCalendar);

/** JS `getDay()` is Sun=0; availability keys are Mon=0 … Sun=6 (same as availability form). */
function jsDayToAvailabilityKey(date: Date): number {
	const sun0 = date.getDay();
	return sun0 === 0 ? 6 : sun0 - 1;
}

function minutesToCalendarTime(totalMinutes: number): Date {
	const h = Math.floor(totalMinutes / 60);
	const m = totalMinutes % 60;
	return new Date(1970, 0, 1, h, m, 0, 0);
}

function earliestAvailabilityStart(
	avail: Availability | undefined,
): number | null {
	if (!avail) return null;
	return Object.values(avail).reduce<number | null>((acc, day) => {
		if (!day?.[0]) return acc;
		if (acc === null) return day[0].start;
		return Math.min(acc, day[0].start);
	}, null);
}

function latestAvailabilityEnd(avail: Availability | undefined): number | null {
	if (!avail) return null;
	return Object.values(avail).reduce<number | null>((acc, day) => {
		if (!day?.[0]) return acc;
		if (acc === null) return day[0].end;
		return Math.max(acc, day[0].end);
	}, null);
}

function buildAvailabilityByDay(avail: Availability | undefined) {
	const map: Record<number, { start: number; end: number }[]> = {};
	for (let day = 0; day < 7; day++) {
		const slots = avail?.[day as keyof Availability] ?? [];
		map[day] = slots.map((s) => ({ start: s.start, end: s.end }));
	}
	return map;
}

export default function AppointmentsCalendar() {
	const {
		data: appointments,
		isLoading,
		mutate,
	} = useSWR("appointments", () => getAppointments());
	const { data: me } = useSWR("me", () => getMe());

	const [currentDate, setCurrentDate] = useState(new Date());
	const [currentView, setCurrentView] = useState<View>("week");
	const [newRange, setNewRange] = useState<{ start: Date; end: Date } | null>(
		null,
	);
	const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
	const moveInFlight = useRef(false);

	const availability = me?.doctorProfile?.availability as
		| Availability
		| undefined;

	const { calendarMin, calendarMax } = useMemo(() => {
		const minM = earliestAvailabilityStart(availability);
		const maxM = latestAvailabilityEnd(availability);
		return {
			calendarMin:
				minM != null ? minutesToCalendarTime(minM) : new Date(0, 0, 0, 8, 0),
			calendarMax:
				maxM != null ? minutesToCalendarTime(maxM) : new Date(0, 0, 0, 17, 30),
		};
	}, [availability]);

	const availabilityByDay = useMemo(
		() => buildAvailabilityByDay(availability),
		[availability],
	);

	const hasConfiguredAvailability = useMemo(
		() => Object.values(availabilityByDay).some((slots) => slots.length > 0),
		[availabilityByDay],
	);

	type SlotChildProps = { style?: CSSProperties };
	const TimeSlotWrapper = useCallback(
		({
			children,
			value,
		}: {
			children: React.ReactElement<SlotChildProps>;
			value: Date;
		}) => {
			if (!hasConfiguredAvailability) {
				return children;
			}
			const dayKey = jsDayToAvailabilityKey(value);
			const dayAvailability = availabilityByDay[dayKey] ?? [];
			const minutesIntoDay = value.getHours() * 60 + value.getMinutes();
			const isDisabledSlot = !dayAvailability.some(
				(slot) => minutesIntoDay >= slot.start && minutesIntoDay < slot.end,
			);
			return cloneElement(children, {
				style: {
					...children.props.style,
					backgroundColor: isDisabledSlot ? "#e2e8f0" : undefined,
					pointerEvents: isDisabledSlot ? "none" : "auto",
					cursor: isDisabledSlot ? "not-allowed" : "pointer",
				},
			});
		},
		[availabilityByDay, hasConfiguredAvailability],
	);

	const events: CalendarEvent[] = useMemo(
		() =>
			(appointments ?? [])
				.filter((a) => a.start && a.end)
				.map((a) => {
					const patientLabel = [a.patient?.firstName, a.patient?.lastName]
						.filter(Boolean)
						.join(" ")
						.trim();
					const displayName = patientLabel || a.newPatientName?.trim() || "—";

					return {
						id: a.id,
						title: (
							<p className="text-[11px]! leading-tight">
								<span className="font-medium">{displayName}</span> — {a.name}
							</p>
						),
						start: new Date(a.start ?? ""),
						end: new Date(a.end ?? ""),
						name: a.name ?? "",
						description: a.description ?? "",
						status: (a.status ?? "confirmed") as CalendarEvent["status"],
						patient: a.patient,
						newPatientName: a.newPatientName,
					};
				}),
		[appointments],
	);

	const handleSelectSlot = useCallback(
		({ start, end }: { start: Date; end: Date }) => {
			const roundedStart = new Date(
				Math.round(start.getTime() / (30 * 60 * 1000)) * (30 * 60 * 1000),
			);
			const roundedEnd = new Date(
				Math.round(end.getTime() / (30 * 60 * 1000)) * (30 * 60 * 1000),
			);

			const isOverlap = events.some(
				(e) => roundedStart < e.end && roundedEnd > e.start,
			);
			if (isOverlap) {
				toast.error("Cannot schedule overlapping appointments");
				return;
			}
			setNewRange({ start: roundedStart, end: roundedEnd });
		},
		[events],
	);

	const handleMoveEvent = useCallback(
		async ({ event, start, end }: EventInteractionArgs<CalendarEvent>) => {
			if (moveInFlight.current) return;

			const startDate = new Date(start);
			const endDate = new Date(end);

			const roundedStart = new Date(
				Math.round(startDate.getTime() / (30 * 60 * 1000)) * (30 * 60 * 1000),
			);
			const roundedEnd = new Date(
				Math.round(endDate.getTime() / (30 * 60 * 1000)) * (30 * 60 * 1000),
			);

			if (roundedEnd <= roundedStart) {
				toast.error("End time must be after start time.");
				return;
			}

			const isOverlap = events.some(
				(e) =>
					e.id !== event.id && roundedStart < e.end && roundedEnd > e.start,
			);
			if (isOverlap) {
				toast.error("Cannot move to an overlapping time slot");
				return;
			}

			moveInFlight.current = true;

			await mutate(
				(current: AppointmentWithPatient[] | undefined) => {
					if (!current) return current;
					return current.map((a) =>
						a.id === event.id
							? { ...a, start: roundedStart, end: roundedEnd }
							: a,
					);
				},
				{ revalidate: false },
			);

			try {
				await updateAppointment({
					id: event.id,
					start: roundedStart.toISOString(),
					end: roundedEnd.toISOString(),
				});
				toast.success("Appointment moved");
				void mutate();
			} catch {
				toast.error("Failed to move appointment");
				void mutate();
			} finally {
				moveInFlight.current = false;
			}
		},
		[events, mutate],
	);

	const eventPropGetter = useCallback((event: CalendarEvent) => {
		if (event.status === "pending") {
			return {
				className:
					"!bg-yellow-600 hover:!bg-yellow-700 !transition !duration-200 !z-10",
			};
		}
		return {
			className:
				"!bg-primary hover:!bg-primary/90 !transition !duration-200 !z-10",
		};
	}, []);

	const slotPropGetter = useCallback(
		() => ({
			className: "z-[1] hover:!bg-green-200 cursor-pointer",
		}),
		[],
	);

	if (isLoading) {
		return (
			<div className="flex justify-center py-16">
				<CubeLoader />
			</div>
		);
	}

	return (
		<div className="overflow-x-auto mt-4">
			<div className="min-w-[600px]">
				<AddAppointmentModal
					open={!!newRange}
					onClose={() => setNewRange(null)}
					range={newRange}
					onSuccess={() => mutate()}
				/>
				<EditAppointmentModal
					open={!!editEvent}
					onClose={() => setEditEvent(null)}
					event={editEvent}
					onSuccess={() => mutate()}
				/>
				<DnDCalendar
					components={{
						// RBC typings use `ComponentType<{}>`; runtime passes `value` + `children`.
						timeSlotWrapper: TimeSlotWrapper as ComponentType,
					}}
					localizer={localizer}
					events={events}
					date={currentDate}
					onNavigate={setCurrentDate}
					view={currentView}
					onView={setCurrentView}
					defaultView="week"
					views={["month", "week", "day", "agenda"]}
					selectable
					onSelectSlot={handleSelectSlot}
					onEventDrop={handleMoveEvent}
					onSelectEvent={(ev) => setEditEvent(ev as CalendarEvent)}
					step={30}
					timeslots={1}
					min={calendarMin}
					max={calendarMax}
					resizable={false}
					toolbar
					showMultiDayTimes={false}
					eventPropGetter={eventPropGetter}
					slotPropGetter={slotPropGetter}
				/>
			</div>
		</div>
	);
}
