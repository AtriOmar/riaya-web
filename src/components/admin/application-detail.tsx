"use client";

import { AlertCircle, Check, CheckCircle2, Clock, X } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import UserInfoReadOnly from "@/components/dashboard/profile/user-info-readonly";
import { CubeLoader } from "@/components/loaders";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

			{/* Application Status Banner */}
			<Alert
				variant={
					app.status === "pending"
						? "warning"
						: app.status === "verified"
							? "success"
							: "destructive"
				}
				className="mb-8"
			>
				{app.status === "pending" && <Clock className="size-4" />}
				{app.status === "verified" && <CheckCircle2 className="size-4" />}
				{app.status === "rejected" && <AlertCircle className="size-4" />}
				<AlertTitle className="flex items-center gap-2 uppercase">
					{app.status} Application
				</AlertTitle>
				<AlertDescription>
					{app.status === "pending" &&
						"This application is currently pending review."}
					{app.status === "verified" &&
						"This application has been verified and approved."}
					{app.status === "rejected" && "This application was rejected."}

					{app.status === "rejected" &&
						app.rejectionReasons &&
						app.rejectionReasons.length > 0 && (
							<div className="mt-3">
								<p className="mb-1 font-medium">Rejection Reasons:</p>
								<ul className="space-y-1 list-disc list-inside">
									{app.rejectionReasons.map((reason, i) => (
										// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
										<li key={i}>{reason}</li>
									))}
								</ul>
							</div>
						)}
				</AlertDescription>
			</Alert>

			{/* Application Info */}
			<div>
				<UserInfoReadOnly info={app} title="" />
			</div>

			{/* Actions */}
			{app.status === "pending" && (
				<div className="flex sm:flex-row flex-col justify-end gap-3 mt-4 pt-6 border-t">
					<Button
						variant="destructive"
						className="w-full sm:w-auto"
						onClick={() => setRejectOpen(true)}
					>
						<X className="mr-2 w-4 h-4" />
						Reject Application
					</Button>
					<Button
						className="w-full sm:w-auto"
						onClick={() => setApproveOpen(true)}
					>
						<Check className="mr-2 w-4 h-4" />
						Approve Application
					</Button>
				</div>
			)}
		</div>
	);
}
