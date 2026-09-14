"use client";

import {
	ArrowRight,
	CalendarDays,
	Clock,
	FileText,
	IdCard,
	Phone,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
	cloneElement,
	type HTMLAttributes,
	type MouseEvent,
	type ReactElement,
	useRef,
	useState,
} from "react";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";
import { formatPhoneDisplay } from "@/lib/phone";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "./edit-appointment-modal";

type TriggerProps = HTMLAttributes<HTMLDivElement>;

type Props = {
	event: CalendarEvent;
	children: ReactElement<TriggerProps>;
	/** Force-close while dragging/selecting so the card doesn't stick open. */
	disabled?: boolean;
};

function patientDisplayName(event: CalendarEvent): string {
	const fromPatient = [event.patient?.firstName, event.patient?.lastName]
		.filter(Boolean)
		.join(" ")
		.trim();
	return fromPatient || event.newPatientName?.trim() || "Unknown patient";
}

function patientInitials(event: CalendarEvent): string {
	const a = event.patient?.firstName?.[0]?.toUpperCase() ?? "";
	const b = event.patient?.lastName?.[0]?.toUpperCase() ?? "";
	if (a || b) return `${a}${b}`;
	const fallback = event.newPatientName?.trim();
	if (fallback) {
		const parts = fallback.split(/\s+/);
		return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "?";
	}
	return "?";
}

function resolvePatientId(event: CalendarEvent): number | null {
	const id = event.patientId ?? event.patient?.id;
	return id != null && id > 0 ? id : null;
}

function formatTime(d: Date): string {
	return d.toLocaleTimeString("en-GB", {
		hour: "2-digit",
		minute: "2-digit",
	});
}

function formatDate(d: Date): string {
	return d.toLocaleDateString("en-GB", {
		weekday: "short",
		day: "2-digit",
		month: "short",
	});
}

export default function AppointmentHoverCard({
	event,
	children,
	disabled = false,
}: Props) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const name = patientDisplayName(event);
	const patientId = resolvePatientId(event);
	const phone =
		event.patient?.phoneNumber?.trim() ||
		event.newPatientPhoneNumber?.trim() ||
		null;
	const cin = event.patient?.cin?.trim() || null;
	const description = event.description?.trim() || null;
	const isPending = event.status === "pending";
	const isNewPatient = !patientId && !!event.newPatientName;

	function clearCloseTimer() {
		if (closeTimer.current) {
			clearTimeout(closeTimer.current);
			closeTimer.current = null;
		}
	}

	function scheduleClose() {
		clearCloseTimer();
		closeTimer.current = setTimeout(() => setOpen(false), 200);
	}

	function handleOpen() {
		if (disabled) return;
		clearCloseTimer();
		setOpen(true);
	}

	function goToPatient(e: MouseEvent) {
		if (!patientId) return;
		e.preventDefault();
		e.stopPropagation();
		setOpen(false);
		router.push(`/dashboard/patients/${patientId}`);
	}

	const avatar = (
		<div
			className={cn(
				"flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tracking-wide",
				isPending
					? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400"
					: "bg-primary/10 text-primary",
			)}
		>
			{patientInitials(event)}
		</div>
	);

	const statusBadge = (
		<span
			className={cn(
				"rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none capitalize",
				isPending
					? "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"
					: "bg-primary/15 text-primary",
			)}
		>
			{event.status}
		</span>
	);

	const trigger = cloneElement(children, {
		onMouseEnter: (e: MouseEvent<HTMLDivElement>) => {
			handleOpen();
			children.props.onMouseEnter?.(e);
		},
		onMouseLeave: (e: MouseEvent<HTMLDivElement>) => {
			scheduleClose();
			children.props.onMouseLeave?.(e);
		},
	});

	return (
		<HoverCard open={disabled ? false : open} onOpenChange={setOpen}>
			<HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
			<HoverCardContent
				side="top"
				align="center"
				sideOffset={2}
				collisionPadding={12}
				className="w-72 p-0"
				onMouseEnter={handleOpen}
				onMouseLeave={scheduleClose}
				onPointerDown={(e) => e.stopPropagation()}
			>
				<div className="flex items-start gap-3 px-3.5 pt-3 pb-2.5">
					{patientId ? (
						<button
							type="button"
							onClick={goToPatient}
							className={cn(
								"group flex min-w-0 flex-1 items-start gap-3 rounded-md -m-1 p-1 text-left",
								"hover:bg-muted/60 transition-colors cursor-pointer",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
							)}
						>
							{avatar}
							<div className="min-w-0 flex-1">
								<p className="font-semibold text-sm leading-snug text-foreground truncate group-hover:text-primary group-hover:underline">
									{name}
								</p>
								<div className="mt-1 flex flex-wrap items-center gap-1.5">
									{statusBadge}
								</div>
								<p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-primary">
									View patient profile
									<ArrowRight className="size-3" />
								</p>
							</div>
						</button>
					) : (
						<>
							{avatar}
							<div className="min-w-0 flex-1">
								<p className="font-semibold text-sm leading-snug text-foreground truncate">
									{name}
								</p>
								<div className="mt-1 flex flex-wrap items-center gap-1.5">
									{statusBadge}
									{isNewPatient ? (
										<span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
											New patient
										</span>
									) : null}
								</div>
							</div>
						</>
					)}
				</div>

				<div className="space-y-2 border-t px-3.5 py-2.5">
					<p className="font-medium text-sm leading-snug text-foreground truncate">
						{event.name || "Appointment"}
					</p>

					<p className="flex items-center gap-2 text-xs text-muted-foreground">
						<CalendarDays className="size-3.5 shrink-0 text-primary" />
						<span>{formatDate(event.start)}</span>
					</p>
					<p className="flex items-center gap-2 text-xs text-muted-foreground">
						<Clock className="size-3.5 shrink-0 text-primary" />
						<span className="tabular-nums">
							{formatTime(event.start)} – {formatTime(event.end)}
						</span>
					</p>

					{phone ? (
						<p className="flex items-center gap-2 text-xs text-muted-foreground">
							<Phone className="size-3.5 shrink-0 text-primary" />
							<span className="tabular-nums">{formatPhoneDisplay(phone)}</span>
						</p>
					) : null}

					{cin ? (
						<p className="flex items-center gap-2 text-xs text-muted-foreground">
							<IdCard className="size-3.5 shrink-0 text-primary" />
							<span>{cin}</span>
						</p>
					) : null}

					{description ? (
						<p className="flex items-start gap-2 text-xs text-muted-foreground">
							<FileText className="mt-0.5 size-3.5 shrink-0 text-primary" />
							<span className="line-clamp-3 leading-snug">{description}</span>
						</p>
					) : null}
				</div>
			</HoverCardContent>
		</HoverCard>
	);
}
