"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Link2, Phone, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { splitCallerName } from "@/lib/caller-name";
import { getErrorMessage } from "@/lib/error-handling";
import {
	formatPhoneDisplay,
	normalizePhoneDigits,
	normalizePhoneForStorage,
} from "@/lib/phone";
import {
	useDeleteApiAppointments,
	usePutApiAppointments,
} from "@/services/generated/appointments/appointments";
import {
	useGetApiPatients,
	useGetApiPatientsLookupByPhone,
} from "@/services/generated/patients/patients";

const schema = z.object({
	name: z.string().min(1, "Name is required"),
	description: z.string(),
});

type FormValues = z.infer<typeof schema>;

export type CalendarEvent = {
	id: number;
	title: React.ReactNode;
	start: Date;
	end: Date;
	name: string;
	description?: string;
	status: "pending" | "confirmed" | "cancelled";
	patientId?: number | null;
	patient?: {
		id: number;
		firstName: string | null;
		lastName: string | null;
		phoneNumber?: string | null;
		cin?: string | null;
		address?: string | null;
	} | null;
	newPatientName?: string | null;
	newPatientPhoneNumber?: string | null;
	urgent?: boolean;
};

type Props = {
	open: boolean;
	onClose: () => void;
	event: CalendarEvent | null;
	onSuccess: () => void;
};

function formatPatientLabel(
	firstName: string | null | undefined,
	lastName: string | null | undefined,
	cin: string | null | undefined,
): string {
	const name = [firstName, lastName].filter(Boolean).join(" ").trim() || "—";
	return cin ? `${name} (${cin})` : name;
}

export default function EditAppointmentModal({
	open,
	onClose,
	event,
	onSuccess,
}: Props) {
	const [pendingAction, setPendingAction] = useState<
		"accept" | "refuse" | null
	>(null);
	const [createNewPatient, setCreateNewPatient] = useState(true);
	const [selectedPatientId, setSelectedPatientId] = useState("");
	const [patientFirstName, setPatientFirstName] = useState("");
	const [patientLastName, setPatientLastName] = useState("");

	const { trigger: updateAppointment, isMutating: isUpdating } =
		usePutApiAppointments();
	const { trigger: deleteAppointment, isMutating: isDeleting } =
		useDeleteApiAppointments({ id: event?.id ?? 0 });
	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<FormValues>({
		resolver: zodResolver(schema),
	});

	const isPending = event?.status === "pending";
	const isUrgent = event?.urgent === true;
	const callerPhoneRaw = event?.newPatientPhoneNumber?.trim() ?? "";
	const callerPhoneStored = normalizePhoneForStorage(callerPhoneRaw);
	const callerPhoneDigits =
		normalizePhoneDigits(callerPhoneRaw) ?? callerPhoneRaw.replace(/\D/g, "");
	const needsPatientLink =
		isPending && !event?.patientId && callerPhoneDigits.length >= 8;

	const { data: phoneLookup, isLoading: lookupLoading } =
		useGetApiPatientsLookupByPhone(
			{ phone: callerPhoneStored ?? callerPhoneDigits },
			{ swr: { enabled: open && needsPatientLink } },
		);

	const { data: patients, isLoading: patientsLoading } = useGetApiPatients(
		{ all: true },
		{ swr: { enabled: open && needsPatientLink && !createNewPatient } },
	);

	const matchedPatient = phoneLookup?.matchedPatient ?? null;

	const callerDisplayName = useMemo(() => {
		if (!event) return "—";
		const fromPatient = [event.patient?.firstName, event.patient?.lastName]
			.filter(Boolean)
			.join(" ")
			.trim();
		return fromPatient || event.newPatientName?.trim() || "—";
	}, [event]);

	useEffect(() => {
		if (event) {
			reset({ name: event.name, description: event.description ?? "" });
			setPendingAction(null);
			setCreateNewPatient(true);
			setSelectedPatientId("");
			const split = splitCallerName(event.newPatientName);
			setPatientFirstName(split.firstName === "Unknown" ? "" : split.firstName);
			setPatientLastName(split.lastName === "—" ? "" : split.lastName);
		}
	}, [event, reset]);

	useEffect(() => {
		if (!needsPatientLink || lookupLoading) return;
		if (matchedPatient) {
			setCreateNewPatient(false);
			setSelectedPatientId(String(matchedPatient.id));
		} else {
			setCreateNewPatient(true);
			setSelectedPatientId("");
		}
	}, [needsPatientLink, lookupLoading, matchedPatient]);

	async function onSubmit(values: FormValues) {
		if (!event) return;
		try {
			await updateAppointment({
				id: event.id,
				name: values.name,
				description: values.description,
			});
			toast.success("Appointment updated");
			onClose();
			onSuccess();
		} catch (err) {
			toast.error(getErrorMessage(err));
		}
	}

	async function handleDelete() {
		if (!event) return;
		try {
			await deleteAppointment();
			toast.success("Appointment deleted");
			onClose();
			onSuccess();
		} catch (err) {
			toast.error(getErrorMessage(err));
		}
	}

	async function handleAccept(values: FormValues) {
		if (!event) return;

		const payload: Parameters<typeof updateAppointment>[0] = {
			id: event.id,
			name: values.name,
			description: values.description,
			status: "confirmed",
		};

		if (needsPatientLink) {
			if (matchedPatient) {
				payload.patientId = matchedPatient.id;
			} else if (createNewPatient) {
				const first = patientFirstName.trim();
				if (!first) {
					toast.error("First name is required to create a patient.");
					return;
				}
				payload.createPatient = true;
				payload.patientFirstName = first;
				payload.patientLastName = patientLastName.trim() || undefined;
			} else {
				if (!selectedPatientId) {
					toast.error("Select a patient or enable creating a new patient.");
					return;
				}
				payload.patientId = Number(selectedPatientId);
			}
		}

		setPendingAction("accept");
		try {
			await updateAppointment(payload);
			toast.success("Appointment accepted");
			onClose();
			onSuccess();
		} catch (err) {
			toast.error(getErrorMessage(err));
		} finally {
			setPendingAction(null);
		}
	}

	async function handleRefuse() {
		if (!event) return;
		setPendingAction("refuse");
		try {
			await updateAppointment({
				id: event.id,
				status: "cancelled",
			});
			toast.success("Appointment refused");
			onClose();
			onSuccess();
		} catch (err) {
			toast.error(getErrorMessage(err));
		} finally {
			setPendingAction(null);
		}
	}

	const patientList = patients ?? [];

	return (
		<Dialog open={open} onOpenChange={(v) => !v && onClose()}>
			<DialogContent className="max-w-[500px]" showCloseButton={false}>
				<DialogHeader>
					<div className="flex items-center gap-2">
						<DialogTitle>
							{isPending
								? isUrgent
									? "Urgent appointment request"
									: "Pending appointment"
								: "Edit Appointment"}
						</DialogTitle>
						{!isPending && (
							<Button
								variant="destructive"
								size="sm"
								className="ml-auto"
								onClick={handleDelete}
								disabled={isDeleting}
							>
								<Trash2 className="w-4 h-4" />
								{isDeleting ? "Deleting..." : "Delete"}
							</Button>
						)}
					</div>
				</DialogHeader>

				{event && (
					<div className="flex flex-wrap items-center gap-3 text-sm">
						<CalendarDays className="w-5 h-5" />
						<span className="font-medium">
							{event.start.toLocaleDateString("en-GB", {
								day: "2-digit",
								month: "short",
								weekday: "short",
								year: "numeric",
							})}
						</span>
						<span>|</span>
						<span>
							From:{" "}
							<span className="px-2 py-0.5 border rounded">
								{event.start.toLocaleTimeString("en-GB", {
									hour: "2-digit",
									minute: "2-digit",
								})}
							</span>
						</span>
						<span>
							To:{" "}
							<span className="px-2 py-0.5 border rounded">
								{event.end.toLocaleTimeString("en-GB", {
									hour: "2-digit",
									minute: "2-digit",
								})}
							</span>
						</span>
					</div>
				)}

				{event?.patient && (
					<div>
						<Label>Patient</Label>
						<div className="px-3 py-1.5 rounded-md bg-muted text-muted-foreground text-sm">
							<Link
								href={`/dashboard/patients/${event.patient.id}`}
								className="text-primary hover:underline"
							>
								{formatPatientLabel(
									event.patient.firstName,
									event.patient.lastName,
									event.patient.cin,
								)}
							</Link>
						</div>
					</div>
				)}

				{needsPatientLink && (
					<div className="space-y-3 rounded-lg border bg-muted/30 p-3">
						<div>
							<p className="text-sm font-medium text-foreground">
								Caller details
							</p>
							<p className="mt-1 text-sm text-muted-foreground">
								{callerDisplayName}
							</p>
							<p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
								<Phone className="size-3.5" />
								<span className="tabular-nums">
									{formatPhoneDisplay(callerPhoneStored ?? callerPhoneRaw)}
								</span>
							</p>
						</div>

						{lookupLoading ? (
							<p className="text-sm text-muted-foreground">
								Looking up patient by phone…
							</p>
						) : matchedPatient ? (
							<div className="flex gap-2 rounded-md border border-primary/20 bg-primary/5 p-2.5">
								<Link2 className="mt-0.5 size-4 shrink-0 text-primary" />
								<div className="min-w-0 text-sm">
									<p className="font-medium text-foreground">
										Existing patient found
									</p>
									<p className="text-muted-foreground">
										This appointment will be linked to{" "}
										<Link
											href={`/dashboard/patients/${matchedPatient.id}`}
											className="font-medium text-primary hover:underline"
										>
											{formatPatientLabel(
												matchedPatient.firstName,
												matchedPatient.lastName,
												matchedPatient.cin,
											)}
										</Link>{" "}
										when you accept.
									</p>
								</div>
							</div>
						) : (
							<div className="space-y-3">
								<label
									htmlFor="create-new-patient"
									className="flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 hover:bg-muted/50"
								>
									<Checkbox
										id="create-new-patient"
										checked={createNewPatient}
										onCheckedChange={(v) => setCreateNewPatient(v === true)}
										className="mt-0.5"
									/>
									<div className="min-w-0">
										<p className="flex items-center gap-1.5 text-sm font-medium">
											<UserPlus className="size-3.5 text-primary" />
											Create new patient
										</p>
										<p className="text-xs text-muted-foreground">
											Adds a patient with the phone on this booking. Edit the
											name below if the caller gave it incorrectly.
										</p>
									</div>
								</label>

								{createNewPatient && (
									<div className="grid grid-cols-2 gap-3 pl-1">
										<div>
											<Label htmlFor="patient-first-name">
												First name <span className="text-destructive">*</span>
											</Label>
											<Input
												id="patient-first-name"
												className="mt-1"
												value={patientFirstName}
												onChange={(e) => setPatientFirstName(e.target.value)}
												placeholder="First name"
											/>
										</div>
										<div>
											<Label htmlFor="patient-last-name">Last name</Label>
											<Input
												id="patient-last-name"
												className="mt-1"
												value={patientLastName}
												onChange={(e) => setPatientLastName(e.target.value)}
												placeholder="Last name"
											/>
										</div>
									</div>
								)}

								{!createNewPatient && (
									<div>
										<Label>
											Assign to existing patient{" "}
											<span className="text-destructive">*</span>
										</Label>
										<Select
											value={selectedPatientId}
											onValueChange={setSelectedPatientId}
										>
											<SelectTrigger className="mt-1">
												<SelectValue placeholder="Select patient" />
											</SelectTrigger>
											<SelectContent>
												{patientsLoading ? (
													<div className="px-2 py-1.5 text-muted-foreground text-sm">
														Loading…
													</div>
												) : patientList.length === 0 ? (
													<div className="px-2 py-1.5 text-muted-foreground text-sm">
														No patients in your list
													</div>
												) : (
													patientList.map((p) => (
														<SelectItem key={p.id} value={String(p.id)}>
															{formatPatientLabel(
																p.firstName,
																p.lastName,
																p.cin,
															)}
														</SelectItem>
													))
												)}
											</SelectContent>
										</Select>
									</div>
								)}
							</div>
						)}
					</div>
				)}

				<form
					onSubmit={
						isPending ? (e) => e.preventDefault() : handleSubmit(onSubmit)
					}
					className="space-y-4"
				>
					<div>
						<Label htmlFor="name">
							Name <span className="text-destructive">*</span>
						</Label>
						<Input id="name" {...register("name")} />
						{errors.name && (
							<p className="mt-1 text-destructive text-sm">
								{errors.name.message}
							</p>
						)}
					</div>
					<div>
						<Label htmlFor="description">Description</Label>
						<Textarea id="description" {...register("description")} />
					</div>
					<div className="flex flex-wrap justify-end gap-2">
						{isPending ? (
							<>
								<Button
									type="button"
									variant="quiet"
									onClick={onClose}
									disabled={!!pendingAction}
								>
									Cancel
								</Button>
								<Button
									type="button"
									variant="destructive"
									onClick={handleRefuse}
									disabled={!!pendingAction || lookupLoading}
								>
									{pendingAction === "refuse" ? "Refusing..." : "Refuse"}
								</Button>
								<Button
									type="button"
									onClick={handleSubmit(handleAccept)}
									disabled={!!pendingAction || lookupLoading}
								>
									{pendingAction === "accept" ? "Accepting..." : "Accept"}
								</Button>
							</>
						) : (
							<>
								<Button type="button" variant="quiet" onClick={onClose}>
									Cancel
								</Button>
								<Button type="submit" disabled={isSubmitting || isUpdating}>
									{isSubmitting || isUpdating ? "Saving..." : "Save"}
								</Button>
							</>
						)}
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
