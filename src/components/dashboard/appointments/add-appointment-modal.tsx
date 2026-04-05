"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import useSWR from "swr";
import { z } from "zod";
import { Button } from "@/components/ui/button";
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
import { createAppointment, getPatients } from "@/services";

const schema = z.object({
	patientId: z.string().min(1, "Patient is required"),
	name: z.string().min(1, "Appointment name is required"),
	description: z.string(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
	open: boolean;
	onClose: () => void;
	range: { start: Date; end: Date } | null;
	onSuccess: () => void;
};

export default function AddAppointmentModal({
	open,
	onClose,
	range,
	onSuccess,
}: Props) {
	const { data: patients } = useSWR("patients-all", () =>
		getPatients({ all: true }),
	);

	const {
		register,
		handleSubmit,
		setValue,
		watch,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: { patientId: "", name: "", description: "" },
	});

	const patientId = watch("patientId");

	async function onSubmit(values: FormValues) {
		if (!range) return;
		try {
			await createAppointment({
				patientId: Number(values.patientId),
				name: values.name,
				description: values.description,
				start: range.start.toISOString(),
				end: range.end.toISOString(),
			});
			toast.success("Appointment created");
			reset();
			onClose();
			onSuccess();
		} catch {
			toast.error("Failed to create appointment");
		}
	}

	return (
		<Dialog open={open} onOpenChange={(v) => !v && onClose()}>
			<DialogContent className="max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Add Appointment</DialogTitle>
				</DialogHeader>

				{range && (
					<div className="flex items-center gap-3 text-sm">
						<CalendarDays className="w-5 h-5" />
						<span className="font-medium">
							{range.start.toLocaleDateString("en-GB", {
								day: "2-digit",
								month: "short",
								weekday: "short",
								year: "numeric",
							})}
						</span>
						<span>|</span>
						<span>
							From:{" "}
							<span className="px-2 py-0.5 border rounded text-sm">
								{range.start.toLocaleTimeString("en-GB", {
									hour: "2-digit",
									minute: "2-digit",
								})}
							</span>
						</span>
						<span>
							To:{" "}
							<span className="px-2 py-0.5 border rounded text-sm">
								{range.end.toLocaleTimeString("en-GB", {
									hour: "2-digit",
									minute: "2-digit",
								})}
							</span>
						</span>
					</div>
				)}

				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<div>
						<Label>
							Patient <span className="text-destructive">*</span>
						</Label>
						<Select
							value={patientId}
							onValueChange={(v) =>
								setValue("patientId", v, { shouldValidate: true })
							}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select patient" />
							</SelectTrigger>
							<SelectContent>
								{(patients ?? []).map((p) => (
									<SelectItem key={p.id} value={String(p.id)}>
										{p.firstName} {p.lastName} ({p.cin})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{errors.patientId && (
							<p className="mt-1 text-destructive text-sm">
								{errors.patientId.message}
							</p>
						)}
					</div>

					<div>
						<Label htmlFor="name">
							Name <span className="text-destructive">*</span>
						</Label>
						<Input id="name" placeholder="Consultation" {...register("name")} />
						{errors.name && (
							<p className="mt-1 text-destructive text-sm">
								{errors.name.message}
							</p>
						)}
					</div>

					<div>
						<Label htmlFor="description">Description</Label>
						<Textarea
							id="description"
							placeholder="Optional details..."
							{...register("description")}
						/>
					</div>

					<div className="flex justify-end gap-2">
						<Button type="button" variant="outline" onClick={onClose}>
							Cancel
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? "Adding..." : "Add"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
