"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import moment from "moment";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CubeLoader } from "@/components/loaders";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GetApiAppointments200Item } from "@/services/generated/api.schemas";
import {
	useGetApiAppointments,
	usePutApiAppointments,
} from "@/services/generated/appointments/appointments";
import { useGetApiUsersMe } from "@/services/generated/users/users";
import type { Availability } from "@/services/types";
import AddAppointmentModal from "./add-appointment-modal";
import AppointmentHoverCard from "./appointment-hover-card";
import EditAppointmentModal, {
	type CalendarEvent,
} from "./edit-appointment-modal";

// ── Constants ──────────────────────────────────────────────────────────────────
const SLOT_H = 48; // px per 30-minute slot
const GUTTER_W = 60; // px, time gutter width
const DEFAULT_MIN = 8 * 60; // 08:00 fallback
const DEFAULT_MAX = 18 * 60; // 18:00 fallback

// ── Date/time helpers ─────────────────────────────────────────────────────────
function weekDaysOf(anchor: Date): Date[] {
	const start = moment(anchor).startOf("week");
	return Array.from({ length: 7 }, (_, i) =>
		start.clone().add(i, "days").toDate(),
	);
}

function dateKey(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayMinutes(d: Date): number {
	return d.getHours() * 60 + d.getMinutes();
}

function snap30(m: number): number {
	return Math.round(m / 30) * 30;
}

function hhmm(m: number): string {
	return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function buildTimeRows(lo: number, hi: number): number[] {
	const start = Math.floor(Math.max(0, lo - 30) / 30) * 30;
	const end = Math.ceil(Math.min(24 * 60, hi + 30) / 30) * 30;
	const rows: number[] = [];
	for (let m = start; m < end; m += 30) rows.push(m);
	return rows;
}

function weekLabel(days: Date[]): string {
	const s = days[0];
	const e = days[6];
	if (!s || !e) return "";
	if (s.getMonth() === e.getMonth())
		return s.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
	return `${s.toLocaleDateString("en-GB", { month: "short" })} – ${e.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`;
}

// ── Availability helpers ──────────────────────────────────────────────────────
/** JS getDay() Sun=0; availability keys Mon=0…Sun=6 */
function jsDayToKey(d: Date): number {
	const n = d.getDay();
	return n === 0 ? 6 : n - 1;
}

function buildAvailMap(
	av: Availability | undefined,
): Record<number, { start: number; end: number }[]> {
	const m: Record<number, { start: number; end: number }[]> = {};
	for (let d = 0; d < 7; d++)
		m[d] = (av?.[d as keyof Availability] ?? []).map((s) => ({
			start: s.start,
			end: s.end,
		}));
	return m;
}

function slotIsAvail(
	aMap: Record<number, { start: number; end: number }[]>,
	day: Date,
	slotMin: number,
): boolean {
	const slots = aMap[jsDayToKey(day)] ?? [];
	if (!slots.length) return true;
	return slots.some((s) => slotMin >= s.start && slotMin < s.end);
}

function getAvailRange(av: Availability | undefined): [number, number] {
	if (!av) return [DEFAULT_MIN, DEFAULT_MAX];
	let lo: number | null = null;
	let hi: number | null = null;
	for (const day of Object.values(av))
		for (const s of day ?? []) {
			if (lo === null || s.start < lo) lo = s.start;
			if (hi === null || s.end > hi) hi = s.end;
		}
	return [lo ?? DEFAULT_MIN, hi ?? DEFAULT_MAX];
}

// ── Overlap layout (columns per day) ─────────────────────────────────────────
type Laid = { ev: CalendarEvent; col: number; totalCols: number };

function layoutDay(evs: CalendarEvent[]): Laid[] {
	const sorted = [...evs].sort((a, b) => a.start.getTime() - b.start.getTime());
	const cols: CalendarEvent[][] = [];

	const laid = sorted.map((ev) => {
		let c = cols.findIndex((col) => {
			const last = col.at(-1);
			return !last || last.end <= ev.start;
		});
		if (c < 0) {
			c = cols.length;
			cols.push([]);
		}
		cols[c]?.push(ev);
		return { ev, col: c, totalCols: 0 };
	});

	for (const item of laid) {
		const used = new Set(
			laid
				.filter((o) => o.ev.start < item.ev.end && o.ev.end > item.ev.start)
				.map((o) => o.col),
		);
		item.totalCols = used.size;
	}
	return laid;
}

// ── Drag/selection state types ────────────────────────────────────────────────
type Sel = { day: Date; lo: number; hi: number };
type DragState = {
	ev: CalendarEvent;
	durationMin: number;
	offsetMin: number;
	ghostDay: Date;
	ghostStart: number;
	moved: boolean;
};

// ── Main component ─────────────────────────────────────────────────────────────
export default function AppointmentsCalendar() {
	const { data: appts, isLoading, mutate } = useGetApiAppointments();
	const { data: me } = useGetApiUsersMe();
	const { trigger: updateAppt } = usePutApiAppointments();

	const [anchor, setAnchor] = useState(new Date());
	const [newRange, setNewRange] = useState<{ start: Date; end: Date } | null>(
		null,
	);
	const [editEv, setEditEv] = useState<CalendarEvent | null>(null);
	const [sel, setSel] = useState<Sel | null>(null);
	const [drag, setDrag] = useState<DragState | null>(null);
	const [isSelecting, setIsSelecting] = useState(false);

	const selStartRef = useRef<{ day: Date; lo: number } | null>(null);
	const moveInFlight = useRef(false);

	// Stable refs so the global mouseup handler always sees fresh state
	const selRef = useRef(sel);
	selRef.current = sel;
	const dragRef = useRef(drag);
	dragRef.current = drag;
	const eventsRef = useRef<CalendarEvent[]>([]);
	const mutateRef = useRef(mutate);
	mutateRef.current = mutate;
	const updateRef = useRef(updateAppt);
	updateRef.current = updateAppt;

	// ── Availability ────────────────────────────────────────────────────────────
	const av = me?.doctorProfile?.availability as Availability | undefined;
	const aMap = useMemo(() => buildAvailMap(av), [av]);
	const hasAv = useMemo(
		() => Object.values(aMap).some((s) => s.length > 0),
		[aMap],
	);
	const [minM, maxM] = useMemo(() => getAvailRange(av), [av]);
	const rows = useMemo(() => buildTimeRows(minM, maxM), [minM, maxM]);
	const gridStart = rows[0] ?? minM;

	// ── Week ────────────────────────────────────────────────────────────────────
	const days = useMemo(() => weekDaysOf(anchor), [anchor]);
	const label = useMemo(() => weekLabel(days), [days]);
	const todayKey = dateKey(new Date());

	// ── Events ──────────────────────────────────────────────────────────────────
	const events: CalendarEvent[] = useMemo(
		() =>
			(appts ?? [])
				.filter((a) => a.start && a.end && a.status !== "cancelled")
				.map((a) => {
					const patient = [a.patient?.firstName, a.patient?.lastName]
						.filter(Boolean)
						.join(" ")
						.trim();
					return {
						id: a.id,
						title: patient || a.newPatientName?.trim() || "—",
						start: new Date(a.start ?? ""),
						end: new Date(a.end ?? ""),
						name: a.name ?? "",
						description: a.description ?? "",
						status: (a.status ?? "confirmed") as CalendarEvent["status"],
						patientId: a.patientId,
						patient: a.patient
							? {
									id: a.patient.id,
									firstName: a.patient.firstName,
									lastName: a.patient.lastName,
									phoneNumber: a.patient.phoneNumber,
									cin: a.patient.cin,
									address: a.patient.address,
								}
							: null,
						newPatientName: a.newPatientName,
						newPatientPhoneNumber: a.newPatientPhoneNumber,
						urgent: a.urgent === true,
					};
				}),
		[appts],
	);
	eventsRef.current = events;

	const byDay = useMemo(() => {
		const m = new Map<string, CalendarEvent[]>();
		for (const ev of events) {
			const k = dateKey(ev.start);
			const arr = m.get(k) ?? [];
			arr.push(ev);
			m.set(k, arr);
		}
		return m;
	}, [events]);

	const layoutMap = useMemo(() => {
		const m = new Map<string, Laid[]>();
		for (const [k, evs] of byDay) m.set(k, layoutDay(evs));
		return m;
	}, [byDay]);

	// ── Global mouseup → commit selection or drag ────────────────────────────
	useEffect(() => {
		async function onUp(e: MouseEvent) {
			const target = e.target as HTMLElement;
			const currentSel = selRef.current;
			const currentDrag = dragRef.current;

			// Clicks inside the hover card (e.g. patient profile) must not open edit.
			if (target.closest('[data-slot="hover-card-content"]')) {
				if (currentDrag) setDrag(null);
				return;
			}

			// Commit selection → open add modal
			if (selStartRef.current && currentSel) {
				selStartRef.current = null;
				setSel(null);
				setIsSelecting(false);

				const d = currentSel.day;
				const start = new Date(d);
				start.setHours(
					Math.floor(currentSel.lo / 60),
					currentSel.lo % 60,
					0,
					0,
				);
				const end = new Date(d);
				end.setHours(Math.floor(currentSel.hi / 60), currentSel.hi % 60, 0, 0);

				if (eventsRef.current.some((e) => start < e.end && end > e.start)) {
					toast.error("Cannot schedule overlapping appointments");
				} else {
					setNewRange({ start, end });
				}
				return;
			}

			// Commit drag → move appointment or open edit modal
			if (currentDrag) {
				setDrag(null);

				// No movement → treat as click on the block itself → open edit modal
				if (!currentDrag.moved) {
					if (
						!target.closest(`[data-appointment-block="${currentDrag.ev.id}"]`)
					) {
						return;
					}
					setEditEv(currentDrag.ev);
					return;
				}

				if (moveInFlight.current) return;

				const newStart = new Date(currentDrag.ghostDay);
				newStart.setHours(
					Math.floor(currentDrag.ghostStart / 60),
					currentDrag.ghostStart % 60,
					0,
					0,
				);
				const newEnd = new Date(
					newStart.getTime() + currentDrag.durationMin * 60000,
				);
				const evId = currentDrag.ev.id;

				if (
					eventsRef.current.some(
						(e) => e.id !== evId && newStart < e.end && newEnd > e.start,
					)
				) {
					toast.error("Cannot move to an overlapping time slot");
					return;
				}

				moveInFlight.current = true;
				await mutateRef.current(
					(cur: GetApiAppointments200Item[] | undefined) =>
						cur?.map((a) =>
							a.id === evId
								? {
										...a,
										start: newStart.toISOString(),
										end: newEnd.toISOString(),
									}
								: a,
						),
					{ revalidate: false },
				);
				try {
					await updateRef.current({
						id: evId,
						start: newStart.toISOString(),
						end: newEnd.toISOString(),
					});
					toast.success("Appointment moved");
					void mutateRef.current();
				} catch {
					toast.error("Failed to move appointment");
					void mutateRef.current();
				} finally {
					moveInFlight.current = false;
				}
			}
		}

		window.addEventListener("mouseup", onUp);
		return () => window.removeEventListener("mouseup", onUp);
	}, []); // stable – reads all mutable state through refs

	// ── Loading ─────────────────────────────────────────────────────────────────
	if (isLoading) {
		return (
			<div className="flex justify-center py-16">
				<CubeLoader />
			</div>
		);
	}

	const isDragging = drag !== null;

	return (
		<div className="relative mt-4">
			<AddAppointmentModal
				open={!!newRange}
				onClose={() => setNewRange(null)}
				range={newRange}
				onSuccess={() => mutate()}
			/>
			<EditAppointmentModal
				open={!!editEv}
				onClose={() => setEditEv(null)}
				event={editEv}
				onSuccess={() => mutate()}
			/>

			<div
				className={cn(
					"border rounded-xl overflow-hidden bg-card shadow-sm",
					isDragging && "select-none",
				)}
			>
				{/* ── Header ──────────────────────────────────────────────────────── */}
				<div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b bg-card/80">
					<div className="flex items-center gap-1.5">
						<Button
							variant="ghost"
							size="icon"
							className="size-7"
							onClick={() => {
								const d = new Date(anchor);
								d.setDate(d.getDate() - 7);
								setAnchor(d);
							}}
						>
							<ChevronLeft className="size-4" />
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="h-7 px-2.5 text-xs"
							onClick={() => setAnchor(new Date())}
						>
							Today
						</Button>
						<Button
							variant="ghost"
							size="icon"
							className="size-7"
							onClick={() => {
								const d = new Date(anchor);
								d.setDate(d.getDate() + 7);
								setAnchor(d);
							}}
						>
							<ChevronRight className="size-4" />
						</Button>
					</div>

					<span className="font-semibold text-sm text-foreground">{label}</span>

					<div className="hidden sm:flex items-center gap-3 text-[11px] text-muted-foreground">
						<span className="flex items-center gap-1.5">
							<span className="inline-block size-3 rounded-sm bg-primary/80" />
							Confirmed
						</span>
						<span className="flex items-center gap-1.5">
							<span className="inline-block size-3 rounded-sm bg-yellow-500" />
							Pending
						</span>
					</div>
				</div>

				{/* ── Grid ────────────────────────────────────────────────────────── */}
				<div className="overflow-x-auto">
					<div style={{ minWidth: 640 }}>
						{/* Day headers – sticky */}
						<div
							className="grid sticky top-0 z-20 bg-card"
							style={{
								gridTemplateColumns: `${GUTTER_W}px repeat(7, 1fr)`,
							}}
						>
							<div
								className="border-b border-r border-border bg-muted/20"
								style={{ width: GUTTER_W }}
							/>
							{days.map((day) => {
								const k = dateKey(day);
								const isToday = k === todayKey;
								const cnt = byDay.get(k)?.length ?? 0;
								return (
									<div
										key={k}
										className={cn(
											"flex flex-col items-center justify-center gap-0.5 py-2.5",
											"border-l border-b border-border transition-colors duration-150",
											isToday && "bg-primary/[0.04]",
										)}
									>
										<span
											className={cn(
												"text-[11px] font-semibold uppercase tracking-wide",
												isToday ? "text-primary" : "text-muted-foreground",
											)}
										>
											{moment(day).format("ddd")}
										</span>
										<span
											className={cn(
												"flex items-center justify-center rounded-full text-sm font-bold leading-none",
												isToday
													? "size-7 bg-primary text-primary-foreground"
													: "size-7 text-foreground",
											)}
										>
											{day.getDate()}
										</span>
										{cnt > 0 ? (
											<span className="mt-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none bg-primary/15 text-primary">
												{cnt}
											</span>
										) : (
											<span className="mt-0.5 h-[14px]" />
										)}
									</div>
								);
							})}
						</div>

						{/* Scrollable time body */}
						<div
							className="overflow-y-auto"
							style={{ maxHeight: "calc(100vh - 280px)", minHeight: 380 }}
						>
							<div
								className="grid"
								style={{
									gridTemplateColumns: `${GUTTER_W}px repeat(7, 1fr)`,
								}}
							>
								{/* Time gutter */}
								<div style={{ width: GUTTER_W }}>
									{rows.map((m) => (
										<div
											key={m}
											style={{ height: SLOT_H }}
											className={cn(
												"flex items-start justify-end pr-3 pt-1",
												m % 60 === 0 ? "border-t border-border/40" : "",
											)}
										>
											{m % 60 === 0 && (
												<span className="text-[10px] font-medium text-muted-foreground/60 leading-none tabular-nums">
													{hhmm(m)}
												</span>
											)}
										</div>
									))}
								</div>

								{/* Day columns */}
								{days.map((day) => {
									const k = dateKey(day);
									const isToday = k === todayKey;
									const laid = layoutMap.get(k) ?? [];
									const selHere = sel && dateKey(sel.day) === k;
									const ghostHere =
										drag?.ghostDay && dateKey(drag.ghostDay) === k;

									return (
										<div
											key={k}
											className={cn(
												"relative border-l border-border/50",
												isToday && "bg-primary/[0.015]",
											)}
										>
											{/* Background slots – handle mouse interactions */}
											{rows.map((slotMin) => {
												const avail = !hasAv || slotIsAvail(aMap, day, slotMin);
												const isHour = slotMin % 60 === 0;
												return (
													<div
														key={slotMin}
														style={{ height: SLOT_H }}
														className={cn(
															isHour
																? "border-t border-border/40"
																: "border-t border-border/10",
															avail
																? cn(
																		"hover:bg-primary/[0.04]",
																		isDragging
																			? "cursor-grabbing"
																			: "cursor-pointer",
																	)
																: "bg-muted/30 cursor-not-allowed",
														)}
														onMouseDown={(e) => {
															if (!avail || isDragging) return;
															e.preventDefault();
															selStartRef.current = { day, lo: slotMin };
															setSel({ day, lo: slotMin, hi: slotMin + 30 });
															setIsSelecting(true);
														}}
														onMouseEnter={() => {
															if (isDragging && drag) {
																// Update drag ghost position
																const newStart = snap30(
																	slotMin - drag.offsetMin,
																);
																const clamped = Math.max(
																	0,
																	Math.min(
																		24 * 60 - drag.durationMin,
																		newStart,
																	),
																);
																setDrag((prev) =>
																	prev
																		? {
																				...prev,
																				ghostDay: day,
																				ghostStart: clamped,
																				moved: true,
																			}
																		: prev,
																);
															} else if (
																isSelecting &&
																selStartRef.current &&
																dateKey(day) ===
																	dateKey(selStartRef.current.day)
															) {
																// Extend selection
																const lo = selStartRef.current.lo;
																if (slotMin + 30 > lo) {
																	setSel({ day, lo, hi: slotMin + 30 });
																} else {
																	setSel({
																		day,
																		lo: slotMin,
																		hi: lo + 30,
																	});
																}
															}
														}}
													/>
												);
											})}

											{/* Selection highlight */}
											{selHere && sel && (
												<div
													className="absolute inset-x-1 rounded bg-primary/20 border border-primary/40 pointer-events-none z-[5]"
													style={{
														top: ((sel.lo - gridStart) / 30) * SLOT_H + 1,
														height: Math.max(
															((sel.hi - sel.lo) / 30) * SLOT_H - 2,
															4,
														),
													}}
												/>
											)}

											{/* Drag ghost */}
											{ghostHere && drag && (
												<div
													className="absolute inset-x-1 rounded-md bg-primary/25 border-2 border-primary/50 pointer-events-none z-[5]"
													style={{
														top:
															((drag.ghostStart - gridStart) / 30) * SLOT_H + 1,
														height: Math.max(
															(drag.durationMin / 30) * SLOT_H - 2,
															4,
														),
													}}
												/>
											)}

											{/* Appointment blocks */}
											{laid.map(({ ev, col, totalCols }) => {
												const isDragged = ev.id === drag?.ev.id;
												const startM = dayMinutes(ev.start);
												const endM = dayMinutes(ev.end);
												const top = ((startM - gridStart) / 30) * SLOT_H;
												const height = Math.max(
													((endM - startM) / 30) * SLOT_H,
													SLOT_H * 0.6,
												);
												const isPending = ev.status === "pending";
												const isUrgent = ev.urgent === true;
												const w = `calc((100% - 8px) / ${totalCols})`;
												const l = `calc(4px + ${col} * (100% - 8px) / ${totalCols})`;

												return (
													<AppointmentHoverCard
														key={ev.id}
														event={ev}
														disabled={isDragging || isSelecting}
													>
														<div
															data-appointment-block={ev.id}
															className={cn(
																"absolute z-10 rounded-md px-2 py-1 overflow-hidden",
																"transition-opacity duration-100",
																isUrgent && isPending
																	? "bg-red-600/90 text-white border border-red-700/30 shadow-sm hover:bg-red-600"
																	: isPending
																		? "bg-yellow-500/90 text-white border border-yellow-600/20 shadow-sm hover:bg-yellow-500"
																		: "bg-primary/90 text-primary-foreground border border-primary/10 shadow-sm hover:bg-primary",
																isDragged
																	? "opacity-30 cursor-grabbing"
																	: cn(
																			isDragging || isSelecting
																				? "pointer-events-none"
																				: "cursor-grab",
																		),
															)}
															style={{
																top: top + 2,
																height: height - 4,
																left: l,
																width: w,
															}}
															onMouseDown={(e) => {
																e.stopPropagation();
																// Pending → open edit immediately
																if (ev.status === "pending") {
																	setEditEv(ev);
																	return;
																}
																const rect =
																	e.currentTarget.getBoundingClientRect();
																const offsetPx = e.clientY - rect.top;
																const durationMin =
																	(ev.end.getTime() - ev.start.getTime()) /
																	60000;
																const offsetMin = Math.min(
																	(offsetPx / SLOT_H) * 30,
																	durationMin / 2,
																);
																setDrag({
																	ev,
																	durationMin,
																	offsetMin,
																	ghostDay: ev.start,
																	ghostStart: dayMinutes(ev.start),
																	moved: false,
																});
															}}
														>
															<p className="text-[11px] font-semibold leading-tight truncate">
																{isUrgent && isPending ? "Urgent · " : ""}
																{typeof ev.title === "string"
																	? ev.title
																	: ev.name}
															</p>
															{height >= 44 && (
																<p className="text-[10px] opacity-75 leading-tight mt-0.5 tabular-nums">
																	{hhmm(startM)}–{hhmm(endM)}
																</p>
															)}
															{height >= 64 && ev.name && (
																<p className="text-[10px] opacity-60 leading-tight mt-0.5 italic truncate">
																	{ev.name}
																</p>
															)}
														</div>
													</AppointmentHoverCard>
												);
											})}
										</div>
									);
								})}
							</div>
						</div>
					</div>
				</div>
			</div>

			<p className="mt-2 text-[11px] text-muted-foreground">
				Drag on empty slots to schedule · Click an appointment to edit · Drag
				appointments to reschedule
			</p>
		</div>
	);
}
