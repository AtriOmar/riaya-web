"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function DevPayClient({
	paymentRef,
	description,
	amountMillimes,
	alreadyCompleted,
}: {
	paymentRef: string;
	description: string;
	amountMillimes: number;
	alreadyCompleted: boolean;
}) {
	const router = useRouter();
	const [loading, setLoading] = useState(false);
	const [done, setDone] = useState(alreadyCompleted);

	const amountTnd = (amountMillimes / 1000).toLocaleString("fr-TN", {
		minimumFractionDigits: 3,
		maximumFractionDigits: 3,
	});

	async function simulateSuccess() {
		setLoading(true);
		try {
			const res = await fetch("/api/billing/dev-pay", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ paymentRef }),
			});
			const data = (await res.json()) as {
				ok?: boolean;
				redirectTo?: string;
				error?: string;
			};

			if (!res.ok || !data.ok) {
				toast.error("Failed to simulate payment.");
				return;
			}

			setDone(true);
			toast.success("Payment simulated — webhook fired.");
			router.push(data.redirectTo ?? "/dashboard/subscription");
			router.refresh();
		} catch {
			toast.error("Failed to simulate payment.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<main className="min-h-screen flex items-center justify-center bg-muted/40 p-6">
			<div className="w-full max-w-md space-y-6 rounded-2xl border bg-background p-8 shadow-sm">
				<div className="space-y-1">
					<p className="text-xs font-medium uppercase tracking-wide text-amber-600">
						Dev payment gateway
					</p>
					<h1 className="text-2xl font-semibold">Fake Konnect checkout</h1>
					<p className="text-sm text-muted-foreground">
						Temporary stand-in while the real gateway is unavailable. Completing
						payment fires the same webhook as Konnect.
					</p>
				</div>

				<div className="rounded-xl border bg-muted/30 p-4 space-y-2 text-sm">
					<div className="flex justify-between gap-4">
						<span className="text-muted-foreground">Description</span>
						<span className="text-right font-medium">{description}</span>
					</div>
					<div className="flex justify-between gap-4">
						<span className="text-muted-foreground">Amount</span>
						<span className="font-medium">{amountTnd} TND</span>
					</div>
					<div className="flex justify-between gap-4">
						<span className="text-muted-foreground">Ref</span>
						<span className="font-mono text-xs break-all">{paymentRef}</span>
					</div>
				</div>

				{done ? (
					<p className="text-sm text-center text-muted-foreground">
						Payment already completed. Redirecting…
					</p>
				) : (
					<Button
						className="w-full"
						size="lg"
						onClick={simulateSuccess}
						disabled={loading}
					>
						{loading && <Loader2 className="size-4 animate-spin mr-2" />}
						Simulate successful payment
					</Button>
				)}
			</div>
		</main>
	);
}
