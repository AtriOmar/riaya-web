"use client";

import { Check, X } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import UserInfoReadOnly from "@/components/dashboard/profile/user-info-readonly";
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
		<div className="space-y-8 max-w-2xl">
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
			<div>
				<UserInfoReadOnly info={app} title="Application Info" />
				<div className="mt-4">
					<p className="font-medium text-muted-foreground text-sm">Status</p>
					<Badge
						className="mt-1"
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

			{/* Actions */}
			{app.status === "pending" && (
				<div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t mt-4">
					<Button
						variant="outline"
						className="w-full sm:w-auto rounded-full border-destructive/30 text-destructive hover:bg-destructive/10 transition-all hover:scale-105 active:scale-95 shadow-sm"
						onClick={() => setRejectOpen(true)}
					>
						<X className="w-4 h-4 mr-2" />
						Reject Application
					</Button>
					<Button
						className="w-full sm:w-auto rounded-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary transition-all hover:scale-105 active:scale-95 shadow-md"
						onClick={() => setApproveOpen(true)}
					>
						<Check className="w-4 h-4 mr-2" />
						Approve Application
					</Button>
				</div>
			)}

			{app.rejectionReasons && app.rejectionReasons.length > 0 && (
				<div className="bg-destructive/5 p-4 rounded-xl">
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
