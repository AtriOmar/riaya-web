"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import BillingInvoicesList from "@/components/dashboard/subscription/billing-invoices-list";
import { RecordingPacksDialog } from "@/components/dashboard/subscription/recording-packs-dialog";
import { UsageMeter } from "@/components/dashboard/subscription/usage-meter";
import { PlansGrid } from "@/components/plans/plans-grid";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/error-handling";
import type { Plan } from "@/lib/plans";
import { formatRecordingTime } from "@/lib/recording-time";
import {
	useGetApiBillingSubscription,
	usePostApiBillingCheckout,
} from "@/services/generated/billing/billing";

function formatDate(iso: string) {
	return new Date(iso).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
}

export default function SubscriptionPanel() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { data, isLoading, mutate } = useGetApiBillingSubscription();
	const { trigger: checkout, isMutating: upgrading } =
		usePostApiBillingCheckout();

	// `?addHours=1` (e.g. from the dashboard or recorder) opens the pack picker
	const [packsOpen, setPacksOpen] = useState(
		searchParams.get("addHours") === "1",
	);

	function setPacksDialog(open: boolean) {
		setPacksOpen(open);
		if (!open && searchParams.get("addHours")) {
			router.replace("/dashboard/subscription", { scroll: false });
		}
	}

	const plan = data?.plan;
	const currentPlanId = plan?.planId ?? "free";
	const periodEnd = data?.subscription.currentPeriodEnd;
	const renewalDate = plan?.isPro && periodEnd ? formatDate(periodEnd) : null;
	const resetsOn = plan ? formatDate(plan.usagePeriod.end) : null;

	async function upgradeToPro() {
		try {
			const res = await checkout({ planId: "pro" });
			if (res.alreadyActive) {
				toast.success("You're already on Pro.");
			} else if (res.payUrl) {
				window.open(res.payUrl, "_blank", "noopener,noreferrer");
				toast.info("Complete payment to activate Pro.");
			}
			await mutate();
		} catch (err) {
			toast.error(getErrorMessage(err, "Could not start checkout."));
		}
	}

	const recording = plan?.recordingTime;

	return (
		<div className="space-y-10">
			<section className="space-y-4">
				<div>
					<h2 className="text-lg font-semibold">Plans</h2>
					<p className="text-sm text-muted-foreground">
						Choose the plan that fits your practice.
						{renewalDate && (
							<span className="ml-1 text-muted-foreground">
								Current period ends{" "}
								<span className="font-medium text-foreground">
									{renewalDate}
								</span>
								.
							</span>
						)}
					</p>
				</div>

				{isLoading ? (
					<div className="flex items-center justify-center py-12">
						<Loader2 className="size-6 animate-spin text-muted-foreground" />
					</div>
				) : (
					<PlansGrid
						animate={false}
						currentPlanId={currentPlanId}
						getBadge={(p) =>
							p.id === currentPlanId ? "Current plan" : undefined
						}
						getAction={(p: Plan) => {
							if (p.id === currentPlanId) {
								return { type: "static", label: "Current plan" };
							}
							if (p.id === "pro") {
								return {
									type: "button",
									label: "Upgrade to Pro",
									onClick: upgradeToPro,
									loading: upgrading,
									disabled: upgrading,
								};
							}
							return { type: "static", label: "Included" };
						}}
					/>
				)}
			</section>

			{plan && recording && (
				<section className="space-y-3">
					<div>
						<h2 className="text-lg font-semibold">Usage this month</h2>
						<p className="text-sm text-muted-foreground">
							Calendar month (UTC)
							{resetsOn && (
								<>
									{" "}
									— resets on{" "}
									<span className="font-medium text-foreground">
										{resetsOn}
									</span>
								</>
							)}
							.
						</p>
					</div>
					<div className="grid max-w-3xl gap-3 sm:grid-cols-3">
						<UsageMeter
							label="Recording time"
							used={recording.usedSeconds}
							limit={recording.includedSeconds}
							format={formatRecordingTime}
						>
							{recording.extraSeconds > 0 && (
								<p className="text-sm text-muted-foreground">
									+ {formatRecordingTime(recording.extraSeconds)} extra
								</p>
							)}
							{plan.canBuyRecordingPacks ? (
								<Button
									variant="outline"
									size="sm"
									className="gap-1.5"
									onClick={() => setPacksDialog(true)}
								>
									<Plus className="size-3.5" />
									Add hours
								</Button>
							) : (
								recording.remainingSeconds <= 0 && (
									<Button size="sm" onClick={upgradeToPro} disabled={upgrading}>
										Upgrade for more
									</Button>
								)
							)}
						</UsageMeter>
						<UsageMeter
							label="WhatsApp sends"
							used={plan.usage.whatsappSendsThisMonth}
							limit={plan.limits.whatsappSendsPerMonth}
						/>
						<UsageMeter
							label="AI assistant messages"
							used={plan.usage.aiMessagesThisMonth}
							limit={plan.limits.aiMessagesPerMonth}
						/>
					</div>
					<p className="text-xs text-muted-foreground">
						WhatsApp sends count invoices and medical files you send.
						Appointment confirmations and review requests are always sent and
						never counted.
					</p>
				</section>
			)}

			<section className="space-y-4">
				<div>
					<h2 className="text-lg font-semibold">Billing invoices</h2>
					<p className="text-sm text-muted-foreground">
						Your Riaya invoices. Pay open ones via Konnect.
					</p>
				</div>
				<BillingInvoicesList />
			</section>

			{plan?.canBuyRecordingPacks && recording && (
				<RecordingPacksDialog
					open={packsOpen}
					onOpenChange={setPacksDialog}
					extraSeconds={recording.extraSeconds}
				/>
			)}
		</div>
	);
}
