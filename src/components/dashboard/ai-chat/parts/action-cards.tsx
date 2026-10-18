"use client";

import { format } from "date-fns";
import {
	AlertTriangle,
	CalendarClock,
	CalendarPlus,
	CalendarRange,
	Check,
	FilePlus2,
	Loader2,
	Plus,
	Receipt,
	X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
	type ActionProposal,
	type AiActionOutcome,
	type AiActionPart,
	MEDICAL_NOTE_TYPES,
} from "@/lib/ai-chat-parts";
import { getErrorMessage } from "@/lib/error-handling";
import { formatTnd, millimesToTnd, parseTndInput } from "@/lib/money";
import { cn } from "@/lib/utils";
import { patchApiAiChatMessagesIdPartsPartId } from "@/services/generated/ai-chat/ai-chat";
import {
	postApiAppointments,
	putApiAppointments,
} from "@/services/generated/appointments/appointments";
import { postApiInvoices } from "@/services/generated/invoices/invoices";
import { postApiPatientsIdMedicalFiles } from "@/services/generated/patients/patients";
import { CardShell, formatWhen } from "./card-shell";

type ActionProps<P extends AiActionPart> = {
	part: P;
	/** Server id of the message; null until the reply is saved. */
	messageId: number | null;
	/** True while the reply is still being written. */
	locked: boolean;
	onChange: (part: AiActionPart) => void;
};

export function ActionPartView(props: ActionProps<AiActionPart>) {
	const { part } = props;
	switch (part.name) {
		case "propose_invoice":
			return <InvoiceAction {...props} part={part} />;
		case "propose_booking_decision":
			return <BookingAction {...props} part={part} />;
		case "propose_medical_note":
			return <NoteAction {...props} part={part} />;
		case "propose_appointment":
			return <AppointmentAction {...props} part={part} />;
		case "propose_reschedule":
			return <RescheduleAction {...props} part={part} />;
	}
}

// ─── Confirm / dismiss ────────────────────────────────────────────────────────

/**
 * Confirm runs the action through its normal route, then records the outcome
 * on the message. If recording fails the action still happened, so the card
 * shows it as done and retries, rather than inviting a second Confirm.
 */
function useDecision<P extends AiActionPart>({
	part,
	messageId,
	onChange,
}: ActionProps<P>) {
	const [busy, setBusy] = useState<"confirm" | "dismiss" | null>(null);
	const [error, setError] = useState<string | null>(null);

	const record = async (
		body: Parameters<typeof patchApiAiChatMessagesIdPartsPartId>[2],
	) => {
		if (messageId == null) return;
		for (let attempt = 1; attempt <= 3; attempt++) {
			try {
				await patchApiAiChatMessagesIdPartsPartId(
					String(messageId),
					part.id,
					body,
				);
				return;
			} catch (err) {
				if (attempt === 3) {
					toast.error(getErrorMessage(err, "Couldn't save this in the chat"));
				}
			}
		}
	};

	const confirm = async (
		run: () => Promise<{
			outcome: AiActionOutcome;
			proposal: P["proposal"];
		}>,
	) => {
		setBusy("confirm");
		setError(null);
		try {
			const { outcome, proposal } = await run();
			onChange({ ...part, status: "confirmed", outcome, proposal } as P);
			toast.success(outcome.label);
			await record({ status: "confirmed", outcome, proposal });
		} catch (err) {
			setError(getErrorMessage(err, "That didn't work"));
		} finally {
			setBusy(null);
		}
	};

	const dismiss = async () => {
		setBusy("dismiss");
		onChange({ ...part, status: "dismissed" });
		await record({ status: "dismissed" });
		setBusy(null);
	};

	return { busy, error, confirm, dismiss };
}

function ActionFrame({
	part,
	locked,
	icon,
	title,
	subtitle,
	confirmLabel,
	canConfirm = true,
	showWarnings = true,
	outcomeHref,
	decision,
	onConfirm,
	children,
}: {
	part: AiActionPart;
	locked: boolean;
	icon: typeof Receipt;
	title: string;
	subtitle?: string;
	confirmLabel: string;
	canConfirm?: boolean;
	showWarnings?: boolean;
	outcomeHref?: string;
	decision: {
		busy: "confirm" | "dismiss" | null;
		error: string | null;
		dismiss: () => void;
	};
	onConfirm: () => void;
	children: React.ReactNode;
}) {
	if (part.status === "dismissed") {
		return (
			<p className="my-2 flex items-center gap-1.5 text-muted-foreground text-xs">
				<X className="size-3.5" />
				Dismissed: {title.toLowerCase()}
			</p>
		);
	}

	return (
		<CardShell
			icon={icon}
			title={title}
			subtitle={subtitle}
			className={cn(part.status === "proposed" && "border-primary/30")}
		>
			<div className="space-y-3 p-3.5">{children}</div>

			{part.status === "proposed" &&
				showWarnings &&
				part.warnings.length > 0 && (
					<div className="mx-3.5 mb-3 space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-800 text-xs dark:text-amber-200">
						{part.warnings.map((w) => (
							<p key={w} className="flex items-start gap-1.5">
								<AlertTriangle className="mt-px size-3.5 shrink-0" />
								{w}
							</p>
						))}
					</div>
				)}

			{part.status === "proposed" && (
				<div className="flex flex-wrap items-center justify-end gap-2 border-t bg-muted/20 px-3.5 py-2.5">
					{decision.error && (
						<p className="mr-auto text-destructive text-xs">{decision.error}</p>
					)}
					<Button
						variant="ghost"
						size="sm"
						disabled={locked || decision.busy !== null}
						onClick={decision.dismiss}
					>
						Dismiss
					</Button>
					<Button
						size="sm"
						disabled={locked || !canConfirm || decision.busy !== null}
						onClick={onConfirm}
					>
						{decision.busy === "confirm" && (
							<Loader2 className="size-3.5 animate-spin" />
						)}
						{confirmLabel}
					</Button>
				</div>
			)}

			{part.status === "confirmed" && (
				<div className="flex items-center gap-2 border-t bg-emerald-500/10 px-3.5 py-2.5 text-emerald-800 text-sm dark:text-emerald-200">
					<Check className="size-4" />
					<span className="flex-1">{part.outcome?.label ?? "Done"}</span>
					{outcomeHref && (
						<Link
							href={outcomeHref}
							className="font-medium text-xs hover:underline"
						>
							Open
						</Link>
					)}
				</div>
			)}

			{part.status === "failed" && (
				<p className="border-t px-3.5 py-2.5 text-destructive text-sm">
					{part.error ?? "It didn't go through."}
				</p>
			)}
		</CardShell>
	);
}

function Field({
	label,
	children,
	className,
}: {
	label: string;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("space-y-1", className)}>
			<p className="font-medium text-muted-foreground text-xs">{label}</p>
			{children}
		</div>
	);
}

// ─── Date and time ────────────────────────────────────────────────────────────

function DateTimeField({
	value,
	onChange,
	disabled,
}: {
	value: Date;
	onChange: (next: Date) => void;
	disabled: boolean;
}) {
	const [open, setOpen] = useState(false);
	return (
		<div className="flex gap-2">
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						className="flex-1 justify-start font-normal"
						disabled={disabled}
					>
						<CalendarRange className="size-4 text-muted-foreground" />
						{format(value, "EEE d MMM yyyy")}
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-auto p-0" align="start">
					<Calendar
						mode="single"
						selected={value}
						onSelect={(day) => {
							if (!day) return;
							const next = new Date(day);
							next.setHours(value.getHours(), value.getMinutes(), 0, 0);
							onChange(next);
							setOpen(false);
						}}
					/>
				</PopoverContent>
			</Popover>
			<Input
				type="time"
				step={300}
				className="w-28"
				disabled={disabled}
				value={format(value, "HH:mm")}
				onChange={(e) => {
					const [h, m] = e.target.value.split(":").map(Number);
					if (Number.isNaN(h) || Number.isNaN(m)) return;
					const next = new Date(value);
					next.setHours(h, m, 0, 0);
					onChange(next);
				}}
			/>
		</div>
	);
}

const MINUTE_MS = 60_000;

// ─── Invoice ──────────────────────────────────────────────────────────────────

type InvoicePart = Extract<AiActionPart, { name: "propose_invoice" }>;

function InvoiceAction(props: ActionProps<InvoicePart>) {
	const { part, locked } = props;
	const decision = useDecision(props);
	const editable = part.status === "proposed" && !locked;
	const [items, setItems] = useState(() =>
		part.proposal.items.map((i) => ({
			description: i.description,
			quantity: String(i.quantity),
			price: String(millimesToTnd(i.unitPriceCentimes)),
		})),
	);
	const [notes, setNotes] = useState(part.proposal.notes);

	const parsed = items.map((i) => ({
		description: i.description.trim(),
		quantity: Number.parseInt(i.quantity, 10),
		unitPriceCentimes: parseTndInput(i.price),
	}));
	const valid = parsed.every(
		(i) => i.description && i.quantity > 0 && i.unitPriceCentimes !== null,
	);
	const total = parsed.reduce(
		(sum, i) => sum + (i.unitPriceCentimes ?? 0) * (i.quantity || 0),
		0,
	);

	const setItem = (index: number, patch: Partial<(typeof items)[number]>) =>
		setItems((prev) =>
			prev.map((i, n) => (n === index ? { ...i, ...patch } : i)),
		);

	const onConfirm = () =>
		decision.confirm(async () => {
			const proposal: ActionProposal<"propose_invoice"> = {
				...part.proposal,
				notes: notes.trim(),
				items: parsed.map((i) => ({
					description: i.description,
					quantity: i.quantity,
					unitPriceCentimes: i.unitPriceCentimes ?? 0,
				})),
			};
			const created = await postApiInvoices({
				patientId: proposal.patientId,
				appointmentId: proposal.appointmentId ?? undefined,
				notes: proposal.notes || undefined,
				items: proposal.items,
			});
			return {
				proposal,
				outcome: {
					kind: "invoice",
					id: created.id,
					label: `Invoice ${created.number} created · ${formatTnd(created.totalCentimes)}`,
				},
			};
		});

	return (
		<ActionFrame
			part={part}
			locked={locked}
			icon={Receipt}
			title="New invoice"
			subtitle={part.proposal.patientName}
			confirmLabel="Create invoice"
			canConfirm={valid}
			outcomeHref="/dashboard/invoices"
			decision={decision}
			onConfirm={onConfirm}
		>
			<div className="space-y-2">
				{items.map((item, index) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: rows have no id and are only appended or removed
						key={index}
						className="flex items-center gap-2"
					>
						<Input
							value={item.description}
							onChange={(e) => setItem(index, { description: e.target.value })}
							placeholder="Description"
							disabled={!editable}
							className="min-w-0 flex-1"
						/>
						<Input
							value={item.quantity}
							onChange={(e) => setItem(index, { quantity: e.target.value })}
							inputMode="numeric"
							aria-label="Quantity"
							disabled={!editable}
							className="w-14 text-center"
						/>
						<div className="relative w-28">
							<Input
								value={item.price}
								onChange={(e) => setItem(index, { price: e.target.value })}
								inputMode="decimal"
								aria-label="Unit price in TND"
								disabled={!editable}
								className="pr-11 text-right"
							/>
							<span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground text-xs">
								TND
							</span>
						</div>
						{editable && items.length > 1 && (
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Remove line"
								onClick={() =>
									setItems((prev) => prev.filter((_, n) => n !== index))
								}
							>
								<X className="size-3.5" />
							</Button>
						)}
					</div>
				))}
				{editable && (
					<Button
						variant="ghost"
						size="sm"
						className="h-7 px-2 text-muted-foreground"
						onClick={() =>
							setItems((prev) => [
								...prev,
								{ description: "", quantity: "1", price: "" },
							])
						}
					>
						<Plus className="size-3.5" />
						Add line
					</Button>
				)}
			</div>
			{(editable || notes) && (
				<Field label="Notes">
					<Input
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
						placeholder="Optional"
						disabled={!editable}
					/>
				</Field>
			)}
			<div className="flex items-center justify-between border-t pt-3">
				<span className="text-muted-foreground text-sm">Total</span>
				<span className="font-semibold tabular-nums">{formatTnd(total)}</span>
			</div>
		</ActionFrame>
	);
}

// ─── Booking decision ─────────────────────────────────────────────────────────

type BookingPart = Extract<AiActionPart, { name: "propose_booking_decision" }>;

function BookingAction(props: ActionProps<BookingPart>) {
	const { part, locked } = props;
	const decision = useDecision(props);
	const { appointment: a, newPatient } = part.proposal;
	const accept = part.proposal.decision === "accept";

	const onConfirm = () =>
		decision.confirm(async () => {
			await putApiAppointments({
				id: a.id,
				status: accept ? "confirmed" : "cancelled",
				...(accept && newPatient
					? {
							createPatient: true,
							patientFirstName: newPatient.firstName,
							patientLastName: newPatient.lastName || undefined,
						}
					: {}),
			});
			return {
				proposal: part.proposal,
				outcome: {
					kind: "appointment",
					id: a.id,
					label: accept
						? `Booking accepted · ${a.patientName}`
						: `Booking refused · ${a.patientName}`,
				},
			};
		});

	return (
		<ActionFrame
			part={part}
			locked={locked}
			icon={CalendarClock}
			title={accept ? "Accept booking" : "Refuse booking"}
			subtitle={a.patientName}
			confirmLabel={accept ? "Accept" : "Refuse"}
			outcomeHref="/dashboard/appointments"
			decision={decision}
			onConfirm={onConfirm}
		>
			<div className="text-sm">
				<p className="font-medium">{formatWhen(a.start, a.end)}</p>
				{a.name && <p className="text-muted-foreground">{a.name}</p>}
				{a.description && (
					<p className="mt-1 text-muted-foreground text-xs">{a.description}</p>
				)}
			</div>
			{accept && newPatient && (
				<p className="rounded-lg bg-muted/50 px-3 py-2 text-xs">
					{`${newPatient.firstName} ${newPatient.lastName}`.trim()} will be
					added as a new patient.
				</p>
			)}
			{accept && (
				<p className="text-muted-foreground text-xs">
					The patient gets the usual WhatsApp confirmation.
				</p>
			)}
		</ActionFrame>
	);
}

// ─── Medical note ─────────────────────────────────────────────────────────────

type NotePart = Extract<AiActionPart, { name: "propose_medical_note" }>;

const NOTE_TYPE_LABELS: Record<(typeof MEDICAL_NOTE_TYPES)[number], string> = {
	consultation: "Consultation",
	prescription: "Prescription",
	"lab-report": "Lab report",
};

function NoteAction(props: ActionProps<NotePart>) {
	const { part, locked } = props;
	const decision = useDecision(props);
	const editable = part.status === "proposed" && !locked;
	const [type, setType] = useState(part.proposal.type);
	const [title, setTitle] = useState(part.proposal.title);
	const [description, setDescription] = useState(part.proposal.description);

	const onConfirm = () =>
		decision.confirm(async () => {
			const proposal = {
				...part.proposal,
				type,
				title: title.trim(),
				description: description.trim(),
			};
			const created = await postApiPatientsIdMedicalFiles(
				String(proposal.patientId),
				{
					type: proposal.type,
					date: new Date().toISOString(),
					title: proposal.title,
					description: proposal.description,
				},
			);
			return {
				proposal,
				outcome: {
					kind: "medical_file",
					id: created.id,
					label: `Saved to ${proposal.patientName}'s file`,
				},
			};
		});

	return (
		<ActionFrame
			part={part}
			locked={locked}
			icon={FilePlus2}
			title="Save to medical file"
			subtitle={part.proposal.patientName}
			confirmLabel="Save note"
			canConfirm={Boolean(title.trim() && description.trim())}
			outcomeHref={`/dashboard/patients/${part.proposal.patientId}`}
			decision={decision}
			onConfirm={onConfirm}
		>
			<div className="flex flex-wrap gap-1.5">
				{MEDICAL_NOTE_TYPES.map((t) => (
					<button
						key={t}
						type="button"
						disabled={!editable}
						onClick={() => setType(t)}
						className={cn(
							"rounded-full border px-2.5 py-1 font-medium text-xs transition-colors disabled:cursor-default",
							type === t
								? "border-primary/40 bg-primary/10 text-primary"
								: "text-muted-foreground hover:bg-accent",
						)}
					>
						{NOTE_TYPE_LABELS[t]}
					</button>
				))}
			</div>
			<Field label="Title">
				<Input
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					disabled={!editable}
				/>
			</Field>
			<Field label="Note">
				<Textarea
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					disabled={!editable}
					className="min-h-32 text-sm"
				/>
			</Field>
		</ActionFrame>
	);
}

// ─── New appointment ──────────────────────────────────────────────────────────

type AppointmentPart = Extract<AiActionPart, { name: "propose_appointment" }>;

function AppointmentAction(props: ActionProps<AppointmentPart>) {
	const { part, locked } = props;
	const decision = useDecision(props);
	const editable = part.status === "proposed" && !locked;
	const initialStart = new Date(part.proposal.start);
	const initialMinutes = Math.round(
		(new Date(part.proposal.end).getTime() - initialStart.getTime()) /
			MINUTE_MS,
	);
	const [start, setStart] = useState(initialStart);
	const [minutes, setMinutes] = useState(String(initialMinutes));
	const [name, setName] = useState(part.proposal.name);
	const duration = Number.parseInt(minutes, 10);
	const timeChanged =
		start.getTime() !== initialStart.getTime() || duration !== initialMinutes;

	const onConfirm = () =>
		decision.confirm(async () => {
			const end = new Date(start.getTime() + duration * MINUTE_MS);
			const proposal = {
				...part.proposal,
				start: start.toISOString(),
				end: end.toISOString(),
				name: name.trim(),
			};
			const created = await postApiAppointments({
				patientId: proposal.patientId,
				start: proposal.start,
				end: proposal.end,
				name: proposal.name,
				description: proposal.description || undefined,
			});
			return {
				proposal,
				outcome: {
					kind: "appointment",
					id: created.id,
					label: `Booked ${formatWhen(proposal.start)}`,
				},
			};
		});

	return (
		<ActionFrame
			part={part}
			locked={locked}
			icon={CalendarPlus}
			title="New appointment"
			subtitle={part.proposal.patientName}
			confirmLabel="Book"
			canConfirm={Boolean(name.trim()) && duration >= 5}
			showWarnings={!timeChanged}
			outcomeHref="/dashboard/appointments"
			decision={decision}
			onConfirm={onConfirm}
		>
			{editable ? (
				<>
					<Field label="When">
						<DateTimeField
							value={start}
							onChange={setStart}
							disabled={!editable}
						/>
					</Field>
					<div className="flex gap-2">
						<Field label="Reason" className="flex-1">
							<Input value={name} onChange={(e) => setName(e.target.value)} />
						</Field>
						<Field label="Minutes" className="w-20">
							<Input
								value={minutes}
								onChange={(e) => setMinutes(e.target.value)}
								inputMode="numeric"
							/>
						</Field>
					</div>
				</>
			) : (
				<div className="text-sm">
					<p className="font-medium">
						{formatWhen(part.proposal.start, part.proposal.end)}
					</p>
					<p className="text-muted-foreground">{part.proposal.name}</p>
				</div>
			)}
		</ActionFrame>
	);
}

// ─── Reschedule ───────────────────────────────────────────────────────────────

type ReschedulePart = Extract<AiActionPart, { name: "propose_reschedule" }>;

function RescheduleAction(props: ActionProps<ReschedulePart>) {
	const { part, locked } = props;
	const decision = useDecision(props);
	const editable = part.status === "proposed" && !locked;
	const { appointment: a } = part.proposal;
	const initialStart = new Date(part.proposal.start);
	const length = new Date(part.proposal.end).getTime() - initialStart.getTime();
	const [start, setStart] = useState(initialStart);
	const timeChanged = start.getTime() !== initialStart.getTime();

	const onConfirm = () =>
		decision.confirm(async () => {
			const proposal = {
				...part.proposal,
				start: start.toISOString(),
				end: new Date(start.getTime() + length).toISOString(),
			};
			await putApiAppointments({
				id: a.id,
				start: proposal.start,
				end: proposal.end,
			});
			return {
				proposal,
				outcome: {
					kind: "appointment",
					id: a.id,
					label: `Moved to ${formatWhen(proposal.start)}`,
				},
			};
		});

	return (
		<ActionFrame
			part={part}
			locked={locked}
			icon={CalendarClock}
			title="Move appointment"
			subtitle={a.patientName}
			confirmLabel="Move"
			showWarnings={!timeChanged}
			outcomeHref="/dashboard/appointments"
			decision={decision}
			onConfirm={onConfirm}
		>
			<div className="text-sm">
				<p className="text-muted-foreground line-through">
					{formatWhen(a.start, a.end)}
				</p>
				{!editable && (
					<p className="font-medium">
						{formatWhen(part.proposal.start, part.proposal.end)}
					</p>
				)}
			</div>
			{editable && (
				<Field label="New time">
					<DateTimeField
						value={start}
						onChange={setStart}
						disabled={!editable}
					/>
				</Field>
			)}
		</ActionFrame>
	);
}
