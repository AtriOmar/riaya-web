"use client";

import { Calendar, FileText, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { CubeLoader } from "@/components/loaders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createMedicalFile, getPatientById } from "@/services";

export default function PatientDetail({ patientId }: { patientId: number }) {
	const {
		data: patient,
		isLoading,
		mutate,
	} = useSWR(`patient-${patientId}`, () => getPatientById(patientId));
	const [addFileOpen, setAddFileOpen] = useState(false);
	const [sending, setSending] = useState(false);

	if (isLoading) {
		return (
			<div className="flex justify-center py-16">
				<CubeLoader />
			</div>
		);
	}

	if (!patient)
		return <p className="text-muted-foreground">Patient not found.</p>;

	async function handleAddFile(e: React.SubmitEvent<HTMLFormElement>) {
		e.preventDefault();
		const fd = new FormData(e.currentTarget);
		setSending(true);
		try {
			await createMedicalFile(patientId, {
				type: fd.get("type") as string,
				date: new Date(fd.get("date") as string).toISOString(),
				title: fd.get("title") as string,
				description: fd.get("description") as string,
			});
			toast.success("Medical file added");
			mutate();
			setAddFileOpen(false);
		} catch {
			toast.error("Failed to add medical file");
		} finally {
			setSending(false);
		}
	}

	return (
		<div className="space-y-6">
			<div className="gap-4 grid sm:grid-cols-2 p-6 border rounded-xl bg-card">
				<div>
					<p className="text-muted-foreground text-sm">CIN</p>
					<p className="font-medium">{patient.cin}</p>
				</div>
				<div>
					<p className="text-muted-foreground text-sm">Full Name</p>
					<p className="font-medium">
						{patient.firstName} {patient.lastName}
					</p>
				</div>
				<div>
					<p className="text-muted-foreground text-sm">Date of Birth</p>
					<p className="font-medium">
						{patient.dateOfBirth
							? new Date(patient.dateOfBirth).toLocaleDateString("en-GB")
							: "—"}
					</p>
				</div>
				<div>
					<p className="text-muted-foreground text-sm">Gender</p>
					<p className="font-medium capitalize">{patient.gender ?? "—"}</p>
				</div>
				{patient.phoneNumber && (
					<div>
						<p className="text-muted-foreground text-sm">Phone</p>
						<p className="font-medium">{patient.phoneNumber}</p>
					</div>
				)}
				{patient.address && (
					<div>
						<p className="text-muted-foreground text-sm">Address</p>
						<p className="font-medium">{patient.address}</p>
					</div>
				)}
			</div>

			<div className="flex justify-between items-center">
				<h4 className="font-semibold text-lg">Medical Files</h4>
				<Dialog open={addFileOpen} onOpenChange={setAddFileOpen}>
					<DialogTrigger asChild>
						<Button size="sm">
							<Plus className="w-4 h-4" />
							Add File
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Add Medical File</DialogTitle>
						</DialogHeader>
						<form onSubmit={handleAddFile} className="space-y-4">
							<div>
								<Label htmlFor="title">Title</Label>
								<Input id="title" name="title" required />
							</div>
							<div>
								<Label htmlFor="type">Type</Label>
								<Input
									id="type"
									name="type"
									placeholder="consultation, prescription, lab-report"
									required
								/>
							</div>
							<div>
								<Label htmlFor="date">Date</Label>
								<Input id="date" name="date" type="date" required />
							</div>
							<div>
								<Label htmlFor="description">Description</Label>
								<Textarea id="description" name="description" />
							</div>
							<Button type="submit" className="w-full" disabled={sending}>
								{sending ? "Adding..." : "Add Medical File"}
							</Button>
						</form>
					</DialogContent>
				</Dialog>
			</div>

			{patient.medicalFiles?.length ? (
				<div className="space-y-3">
					{patient.medicalFiles.map((file) => (
						<div
							key={file.id}
							className="flex items-start gap-3 p-4 border rounded-xl bg-card"
						>
							<FileText className="w-5 h-5 mt-0.5 text-primary shrink-0" />
							<div className="grow">
								<div className="flex items-center gap-2">
									<p className="font-medium">{file.title}</p>
									<Badge variant="outline" className="text-xs">
										{file.type}
									</Badge>
								</div>
								{file.description && (
									<p className="mt-1 text-muted-foreground text-sm">
										{file.description}
									</p>
								)}
								<div className="flex items-center gap-1 mt-1 text-muted-foreground text-xs">
									<Calendar className="w-3 h-3" />
									{file.date
										? new Date(file.date).toLocaleDateString("en-GB")
										: "—"}
								</div>
							</div>
						</div>
					))}
				</div>
			) : (
				<p className="py-8 text-muted-foreground text-center">
					No medical files yet.
				</p>
			)}
		</div>
	);
}
