"use client";

import { Check, X } from "lucide-react";
import Image from "next/image";
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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	getDoctorApplicationById,
	updateDoctorApplicationStatus,
} from "@/services";

export default function ApplicationDetail({
	applicationId,
}: {
	applicationId: number;
}) {
	const {
		data: app,
		isLoading,
		mutate,
	} = useSWR(`admin-application-${applicationId}`, () =>
		getDoctorApplicationById(applicationId),
	);
	const [approveOpen, setApproveOpen] = useState(false);
	const [rejectOpen, setRejectOpen] = useState(false);
	const [rejectReasons, setRejectReasons] = useState("");
	const [saving, setSaving] = useState(false);

	if (isLoading) {
		return (
			<div className="flex justify-center py-16">
				<CubeLoader />
			</div>
		);
	}

	if (!app)
		return <p className="text-muted-foreground">Application not found.</p>;

	const cabinetCityName =
		app.cabinetCity?.enName ??
		app.cabinetCity?.frName ??
		app.cabinetCity?.arName;
	const specialityName =
		app.speciality?.enName ?? app.speciality?.frName ?? app.speciality?.arName;

	async function handleApprove() {
		setSaving(true);
		try {
			await updateDoctorApplicationStatus(applicationId, {
				status: "verified",
			});
			toast.success("Application approved");
			setApproveOpen(false);
			mutate();
		} catch {
			toast.error("Failed to approve application");
		} finally {
			setSaving(false);
		}
	}

	async function handleReject() {
		setSaving(true);
		try {
			const reasons = rejectReasons
				.split("\n")
				.map((r) => r.trim())
				.filter(Boolean);
			await updateDoctorApplicationStatus(applicationId, {
				status: "rejected",
				rejectionReasons: reasons,
			});
			toast.success("Application rejected");
			setRejectOpen(false);
			mutate();
		} catch {
			toast.error("Failed to reject application");
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="space-y-6 max-w-2xl">
			{/* Approve Dialog */}
			<Dialog open={approveOpen} onOpenChange={setApproveOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Approve Application</DialogTitle>
					</DialogHeader>
					<p className="text-muted-foreground text-sm">
						Are you sure you want to approve this doctor application?
					</p>
					<div className="flex justify-end gap-2 mt-4">
						<Button variant="outline" onClick={() => setApproveOpen(false)}>
							Cancel
						</Button>
						<Button onClick={handleApprove} disabled={saving}>
							Approve
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			{/* Reject Dialog */}
			<Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Reject Application</DialogTitle>
					</DialogHeader>
					<div className="space-y-3">
						<Label>Rejection Reasons (one per line)</Label>
						<Textarea
							value={rejectReasons}
							onChange={(e) => setRejectReasons(e.target.value)}
							rows={4}
							placeholder="Reason 1&#10;Reason 2"
						/>
						<div className="flex justify-end gap-2">
							<Button variant="outline" onClick={() => setRejectOpen(false)}>
								Cancel
							</Button>
							<Button
								variant="destructive"
								onClick={handleReject}
								disabled={saving}
							>
								Reject
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Application Info */}
			<div className="gap-4 grid sm:grid-cols-2 p-6 border rounded-xl bg-card">
				<div>
					<p className="text-muted-foreground text-sm">Email</p>
					<p className="font-medium">{app.user?.email ?? "—"}</p>
				</div>
				<div>
					<p className="text-muted-foreground text-sm">Name</p>
					<p className="font-medium">
						{app.firstName} {app.lastName}
					</p>
				</div>
				<div>
					<p className="text-muted-foreground text-sm">TIN</p>
					<p className="font-medium">{app.tin}</p>
				</div>
				<div>
					<p className="text-muted-foreground text-sm">Cabinet Name</p>
					<p className="font-medium">{app.cabinetName}</p>
				</div>
				<div>
					<p className="text-muted-foreground text-sm">Cabinet City</p>
					<p className="font-medium">{cabinetCityName ?? "—"}</p>
				</div>
				<div>
					<p className="text-muted-foreground text-sm">Speciality</p>
					<p className="font-medium">{specialityName ?? "—"}</p>
				</div>
				<div>
					<p className="text-muted-foreground text-sm">Status</p>
					<Badge
						variant={
							app.status === "pending"
								? "secondary"
								: app.status === "verified"
									? "default"
									: "destructive"
						}
					>
						{app.status}
					</Badge>
				</div>
			</div>

			{/* CIN Images */}
			<div className="gap-4 grid lg:grid-cols-2">
				{app.cinRecto && (
					<div>
						<p className="mb-2 font-medium text-muted-foreground text-sm">
							CIN Recto
						</p>
						<Image
							unoptimized
							src={app.cinRecto}
							alt="CIN Recto"
							width={400}
							height={300}
							className="w-full max-w-[400px] border rounded-lg"
						/>
					</div>
				)}
				{app.cinVerso && (
					<div>
						<p className="mb-2 font-medium text-muted-foreground text-sm">
							CIN Verso
						</p>
						<Image
							unoptimized
							src={app.cinVerso}
							alt="CIN Verso"
							width={400}
							height={300}
							className="w-full max-w-[400px] border rounded-lg"
						/>
					</div>
				)}
			</div>

			{/* Actions */}
			{app.status === "pending" && (
				<div className="flex gap-3">
					<Button onClick={() => setApproveOpen(true)}>
						<Check className="w-4 h-4" />
						Approve
					</Button>
					<Button variant="destructive" onClick={() => setRejectOpen(true)}>
						<X className="w-4 h-4" />
						Reject
					</Button>
				</div>
			)}

			{app.rejectionReasons && app.rejectionReasons.length > 0 && (
				<div className="p-4 border border-destructive/30 rounded-xl bg-destructive/5">
					<p className="mb-2 font-medium text-destructive text-sm">
						Rejection Reasons:
					</p>
					<ul className="space-y-1 ml-6 list-disc">
						{app.rejectionReasons.map((r) => (
							<li key={r} className="text-destructive/80 text-sm">
								{r}
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
