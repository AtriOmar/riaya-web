import { differenceInYears, format } from "date-fns";
import {
	BarChart3,
	CalendarClock,
	CalendarDays,
	Clock,
	Loader2,
	Receipt,
	Search,
	UserRound,
} from "lucide-react";
import Link from "next/link";
import type {
	AiAppointment,
	AiInvoice,
	AiPatient,
	AiToolPart,
	ReadToolName,
	ReadToolResult,
} from "@/lib/ai-chat-parts";
import { formatTnd } from "@/lib/money";
import { personDisplayName } from "@/lib/person-name";
import { CardEmpty, CardShell, formatDay, StatusPill } from "./card-shell";

const RUNNING_LABELS: Record<ReadToolName, string> = {
	get_schedule: "Checking your schedule…",
	get_pending_bookings: "Looking at pending bookings…",
	search_patients: "Searching your patients…",
	get_patient_summary: "Reading the patient's file…",
	get_free_slots: "Finding free slots…",
	get_invoices: "Looking up invoices…",
	get_practice_stats: "Checking your numbers…",
};

export function ToolPartView({ part }: { part: AiToolPart }) {
	if (part.status === "running") {
		return (
			<p className="my-2 flex items-center gap-2 text-muted-foreground text-sm">
				<Loader2 className="size-3.5 animate-spin" />
				{RUNNING_LABELS[part.name]}
			</p>
		);
	}
	if (part.status === "error" || !part.result) {
		return (
			<p className="my-2 text-muted-foreground text-xs">
				Couldn't look that up{part.error ? `: ${part.error}` : "."}
			</p>
		);
	}

	switch (part.name) {
		case "get_schedule":
			return <ScheduleCard result={part.result} />;
		case "get_pending_bookings":
			return <PendingCard result={part.result} />;
		case "search_patients":
			return <PatientsCard result={part.result} />;
		case "get_patient_summary":
			return <PatientSummaryCard result={part.result} />;
		case "get_free_slots":
			return <SlotsCard result={part.result} />;
		case "get_invoices":
			return <InvoicesCard result={part.result} />;
		case "get_practice_stats":
			return <StatsCard result={part.result} />;
	}
}

// ─── Rows ─────────────────────────────────────────────────────────────────────

function AppointmentRow({
	appointment: a,
	showDate = true,
}: {
	appointment: AiAppointment;
	showDate?: boolean;
}) {
	const time = a.start
		? format(new Date(a.start), showDate ? "EEE d MMM · HH:mm" : "HH:mm")
		: "—";
	const name = a.patientId ? (
		<Link
			href={`/dashboard/patients/${a.patientId}`}
			className="hover:underline"
		>
			{a.patientName}
		</Link>
	) : (
		a.patientName
	);
	return (
		<li className="flex items-center gap-3 px-3.5 py-2.5">
			<span className="w-24 shrink-0 font-medium text-sm tabular-nums sm:w-32">
				{time}
			</span>
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm">{name}</p>
				{a.name && (
					<p className="truncate text-muted-foreground text-xs">{a.name}</p>
				)}
			</div>
			{a.urgent && (
				<span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-[11px] text-destructive">
					Urgent
				</span>
			)}
			<StatusPill status={a.status} />
		</li>
	);
}

function patientAge(p: AiPatient) {
	return p.dateOfBirth
		? `${differenceInYears(new Date(), new Date(p.dateOfBirth))} y`
		: null;
}

function InvoiceRow({ invoice: i }: { invoice: AiInvoice }) {
	const due = i.totalCentimes - i.amountPaidCentimes;
	return (
		<li className="flex items-center gap-3 px-3.5 py-2.5">
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm">
					<span className="font-medium">{i.number}</span> · {i.patientName}
				</p>
				{i.issuedAt && (
					<p className="text-muted-foreground text-xs">
						{format(new Date(i.issuedAt), "d MMM yyyy")}
						{due > 0 && i.status !== "cancelled" && i.amountPaidCentimes > 0
							? ` · ${formatTnd(due)} left`
							: ""}
					</p>
				)}
			</div>
			<span className="shrink-0 font-medium text-sm tabular-nums">
				{formatTnd(i.totalCentimes)}
			</span>
			<StatusPill status={i.status} />
		</li>
	);
}

// ─── Cards ────────────────────────────────────────────────────────────────────

function ScheduleCard({ result }: { result: ReadToolResult<"get_schedule"> }) {
	const singleDay = result.from === result.to;
	const subtitle = singleDay
		? formatDay(result.from)
		: `${formatDay(result.from)} – ${formatDay(result.to)}`;
	return (
		<CardShell
			icon={CalendarDays}
			title={`${result.appointments.length} appointment${result.appointments.length === 1 ? "" : "s"}`}
			subtitle={subtitle}
			href="/dashboard/appointments"
			hrefLabel="Calendar"
		>
			{result.appointments.length === 0 ? (
				<CardEmpty>Nothing scheduled.</CardEmpty>
			) : (
				<ul className="max-h-80 divide-y overflow-y-auto">
					{result.appointments.map((a) => (
						<AppointmentRow key={a.id} appointment={a} showDate={!singleDay} />
					))}
				</ul>
			)}
		</CardShell>
	);
}

function PendingCard({
	result,
}: {
	result: ReadToolResult<"get_pending_bookings">;
}) {
	const n = result.appointments.length;
	return (
		<CardShell
			icon={CalendarClock}
			title={
				n ? `${n} booking${n === 1 ? "" : "s"} waiting` : "No pending bookings"
			}
			subtitle={
				n ? "Ask me to accept or refuse them, or use the calendar" : undefined
			}
			href="/dashboard/appointments"
			hrefLabel="Calendar"
		>
			{n > 0 && (
				<ul className="max-h-80 divide-y overflow-y-auto">
					{result.appointments.map((a) => (
						<AppointmentRow key={a.id} appointment={a} />
					))}
				</ul>
			)}
		</CardShell>
	);
}

function PatientsCard({
	result,
}: {
	result: ReadToolResult<"search_patients">;
}) {
	return (
		<CardShell
			icon={Search}
			title={`Patients matching "${result.query}"`}
			subtitle={`${result.patients.length} found`}
		>
			{result.patients.length === 0 ? (
				<CardEmpty>No patient matches.</CardEmpty>
			) : (
				<ul className="divide-y">
					{result.patients.map((p) => (
						<li key={p.id}>
							<Link
								href={`/dashboard/patients/${p.id}`}
								className="flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-accent/50"
							>
								<span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
									<UserRound className="size-3.5" />
								</span>
								<span className="min-w-0 flex-1 truncate text-sm">
									{personDisplayName(p) || "Unnamed patient"}
								</span>
								<span className="shrink-0 text-muted-foreground text-xs">
									{[patientAge(p), p.cin].filter(Boolean).join(" · ")}
								</span>
							</Link>
						</li>
					))}
				</ul>
			)}
		</CardShell>
	);
}

function PatientSummaryCard({
	result,
}: {
	result: ReadToolResult<"get_patient_summary">;
}) {
	const { patient: p } = result;
	const lastNote = result.recordings.find((r) => r.summary)?.summary;
	const owed = result.unpaidInvoices.reduce(
		(sum, i) => sum + i.totalCentimes - i.amountPaidCentimes,
		0,
	);
	return (
		<CardShell
			icon={UserRound}
			title={personDisplayName(p) || "Unnamed patient"}
			subtitle={
				[patientAge(p), p.cin && `CIN ${p.cin}`, p.phoneNumber]
					.filter(Boolean)
					.join(" · ") || undefined
			}
			href={`/dashboard/patients/${p.id}`}
			hrefLabel="Open file"
		>
			<div className="divide-y text-sm">
				{result.appointments.length > 0 && (
					<Section label="Visits">
						<ul className="divide-y">
							{result.appointments.slice(0, 4).map((a) => (
								<AppointmentRow key={a.id} appointment={a} />
							))}
						</ul>
					</Section>
				)}
				{lastNote && (lastNote.assessment || lastNote.plan) && (
					<Section label="Last consultation note">
						<div className="space-y-1.5 px-3.5 pb-3 text-sm">
							{lastNote.assessment && (
								<p>
									<span className="text-muted-foreground">Assessment: </span>
									{lastNote.assessment}
								</p>
							)}
							{lastNote.plan && (
								<p className="whitespace-pre-line">
									<span className="text-muted-foreground">Plan: </span>
									{lastNote.plan}
								</p>
							)}
						</div>
					</Section>
				)}
				{result.medicalFiles.length > 0 && (
					<Section label="Medical files">
						<ul className="space-y-1 px-3.5 pb-3">
							{result.medicalFiles.slice(0, 4).map((f) => (
								<li key={f.id} className="flex gap-2">
									<span className="min-w-0 flex-1 truncate">
										{f.title ?? "Untitled"}
									</span>
									{f.date && (
										<span className="shrink-0 text-muted-foreground text-xs">
											{format(new Date(f.date), "d MMM yyyy")}
										</span>
									)}
								</li>
							))}
						</ul>
					</Section>
				)}
				{owed > 0 && (
					<p className="px-3.5 py-2.5 text-amber-700 text-sm dark:text-amber-300">
						Owes {formatTnd(owed)} on {result.unpaidInvoices.length} invoice
						{result.unpaidInvoices.length === 1 ? "" : "s"}
					</p>
				)}
			</div>
		</CardShell>
	);
}

function Section({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="pt-2.5">
			<p className="px-3.5 pb-1 font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
				{label}
			</p>
			{children}
		</div>
	);
}

function SlotsCard({ result }: { result: ReadToolResult<"get_free_slots"> }) {
	return (
		<CardShell
			icon={Clock}
			title="Free slots"
			subtitle={formatDay(result.date)}
		>
			{result.slots.length === 0 ? (
				<CardEmpty>No free slot that day.</CardEmpty>
			) : (
				<div className="flex flex-wrap gap-1.5 p-3">
					{result.slots.map((s) => (
						<span
							key={s.start}
							className="rounded-md border bg-muted/40 px-2 py-1 font-medium text-xs tabular-nums"
						>
							{format(new Date(s.start), "HH:mm")}
						</span>
					))}
				</div>
			)}
		</CardShell>
	);
}

function InvoicesCard({ result }: { result: ReadToolResult<"get_invoices"> }) {
	const due = result.invoices
		.filter((i) => i.status === "unpaid" || i.status === "partially_paid")
		.reduce((sum, i) => sum + i.totalCentimes - i.amountPaidCentimes, 0);
	return (
		<CardShell
			icon={Receipt}
			title={`${result.invoices.length} invoice${result.invoices.length === 1 ? "" : "s"}`}
			subtitle={due > 0 ? `${formatTnd(due)} still to collect` : undefined}
			href="/dashboard/invoices"
			hrefLabel="Invoices"
		>
			{result.invoices.length === 0 ? (
				<CardEmpty>No invoices.</CardEmpty>
			) : (
				<ul className="max-h-80 divide-y overflow-y-auto">
					{result.invoices.map((i) => (
						<InvoiceRow key={i.id} invoice={i} />
					))}
				</ul>
			)}
		</CardShell>
	);
}

function StatsCard({
	result,
}: {
	result: ReadToolResult<"get_practice_stats">;
}) {
	const tiles = [
		{ label: "Today", value: result.appointmentsToday },
		{ label: "Next 7 days", value: result.appointmentsThisWeek },
		{ label: "Pending", value: result.pendingAppointments },
		{ label: "Patients", value: result.patients },
		{
			label: "Collected this month",
			value: formatTnd(result.collectedThisMonthCentimes),
		},
		{ label: "Outstanding", value: formatTnd(result.outstandingCentimes) },
	];
	return (
		<CardShell
			icon={BarChart3}
			title="Your practice"
			href="/dashboard"
			hrefLabel="Dashboard"
		>
			<div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
				{tiles.map((t) => (
					<div key={t.label} className="bg-background px-3.5 py-3">
						<p className="text-muted-foreground text-xs">{t.label}</p>
						<p className="mt-0.5 font-semibold text-lg tabular-nums">
							{t.value}
						</p>
					</div>
				))}
			</div>
		</CardShell>
	);
}
