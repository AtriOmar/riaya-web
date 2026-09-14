"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import BillingInvoicesList from "@/components/dashboard/subscription/billing-invoices-list";
import { PlansGrid } from "@/components/plans/plans-grid";
import { getErrorMessage } from "@/lib/error-handling";
import { PLAN_IDS, type Plan, type PlanId } from "@/lib/plans";

type Subscription = {
	id: number;
	planId: string;
	status: "active" | "canceled" | "past_due";
	currentPeriodEnd: string | null;
	cancelAtPeriodEnd: boolean;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function SubscriptionPanel() {
	const {
		data: subscription,
		isLoading,
		mutate,
	} = useSWR<Subscription>("/api/billing/subscription", fetcher);
	const [upgrading, setUpgrading] = useState(false);

	const currentPlanId: PlanId =
		subscription && PLAN_IDS.includes(subscription.planId as PlanId)
			? (subscription.planId as PlanId)
			: "free";

	const renewalDate = subscription?.currentPeriodEnd
		? new Date(subscription.currentPeriodEnd).toLocaleDateString("en-GB", {
				day: "numeric",
				month: "long",
				year: "numeric",
			})
		: null;

	async function upgradeToPro() {
		setUpgrading(true);
		try {
			const res = await fetch("/api/billing/checkout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ planId: "pro" }),
			});
			const data = (await res.json()) as {
				payUrl?: string | null;
				alreadyActive?: boolean;
				error?: string;
				message?: string;
			};

			if (!res.ok) {
				toast.error(
					data.message ??
						getErrorMessage({ response: { data } }, "Checkout failed."),
				);
				return;
			}

			if (data.alreadyActive) {
				toast.success("You're already on Pro.");
				await mutate();
				return;
			}

			if (data.payUrl) {
				window.open(data.payUrl, "_blank", "noopener,noreferrer");
				toast.info("Complete payment to activate Pro.");
				await mutate();
				return;
			}

			toast.error("Could not start payment. Please try again.");
		} catch (err) {
			toast.error(getErrorMessage(err, "Could not start checkout."));
		} finally {
			setUpgrading(false);
		}
	}

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
						getBadge={(plan) =>
							plan.id === currentPlanId ? "Current plan" : undefined
						}
						getAction={(plan: Plan) => {
							if (plan.id === currentPlanId) {
								return { type: "static", label: "Current plan" };
							}

							if (plan.id === "pro") {
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

			<section className="space-y-4">
				<div>
					<h2 className="text-lg font-semibold">Billing invoices</h2>
					<p className="text-sm text-muted-foreground">
						Your Riaya subscription invoices. Pay open ones via Konnect.
					</p>
				</div>
				<BillingInvoicesList />
			</section>
		</div>
	);
}
