"use client";

import { Check, Loader2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { PLAN_LIST, type Plan, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";

type PricingCardAction =
	| { type: "link"; href: string; label: string }
	| {
			type: "button";
			label: string;
			onClick: () => void;
			disabled?: boolean;
			loading?: boolean;
	  }
	| { type: "static"; label: string };

function PricingCard({
	plan,
	index,
	action,
	badge,
	animate = true,
	isCurrent = false,
}: {
	plan: Plan;
	index: number;
	action: PricingCardAction;
	badge?: string;
	animate?: boolean;
	isCurrent?: boolean;
}) {
	return (
		<div
			className="h-full"
			{...(animate
				? { "data-aos": "fade-up", "data-aos-delay": index * 100 }
				: {})}
		>
			<div
				className={cn(
					"relative flex h-full flex-col rounded-2xl p-8 transition-all duration-300 hover:-translate-y-2",
					plan.popular
						? "bg-linear-to-br from-primary to-primary-700 text-primary-foreground shadow-glow"
						: "border border-primary/15 bg-linear-to-br from-primary-50 to-background shadow-soft",
					isCurrent &&
						(plan.popular
							? "ring-2 ring-primary-foreground/80"
							: "ring-2 ring-primary shadow-medium"),
				)}
			>
				{(isCurrent || badge || plan.popular) && (
					<div
						className={cn(
							"-top-4 left-1/2 absolute px-4 py-1 rounded-full font-semibold text-sm -translate-x-1/2",
							isCurrent
								? "bg-amber-400 text-amber-950"
								: "bg-accent text-secondary-foreground",
						)}
					>
						{badge ?? (isCurrent ? "Current plan" : "Most Popular")}
					</div>
				)}

				<div className="mb-8 text-center">
					<h3
						className={cn(
							"text-xl font-semibold mb-2",
							!plan.popular && "text-card-foreground",
						)}
					>
						{plan.name}
					</h3>
					<p
						className={cn(
							"text-sm mb-4",
							plan.popular
								? "text-primary-foreground/80"
								: "text-muted-foreground",
						)}
					>
						{plan.description}
					</p>
					<div className="flex justify-center items-baseline gap-1">
						{plan.priceTnd === 0 ? (
							<span className="font-bold text-4xl">Free</span>
						) : (
							<>
								<span
									className={cn(
										"text-lg",
										!plan.popular && "text-muted-foreground",
									)}
								>
									TND
								</span>
								<span className="font-bold text-4xl">{plan.priceTnd}</span>
								<span
									className={
										plan.popular
											? "text-primary-foreground/80"
											: "text-muted-foreground"
									}
								>
									/month
								</span>
							</>
						)}
					</div>
				</div>

				<ul className="mb-8 flex-1 space-y-4">
					{plan.features.map((feature) => (
						<li key={feature} className="flex items-start gap-3">
							<div
								className={cn(
									"w-5 h-5 rounded-full flex items-center justify-center shrink-0",
									plan.popular ? "bg-primary-foreground/20" : "bg-accent",
								)}
							>
								<Check
									className={cn(
										"w-3 h-3",
										plan.popular ? "text-primary-foreground" : "text-primary",
									)}
								/>
							</div>
							<span
								className={cn(
									"text-sm",
									plan.popular
										? "text-primary-foreground"
										: "text-foreground/80",
								)}
							>
								{feature}
							</span>
						</li>
					))}
				</ul>

				<div className="mt-auto">
					{action.type === "link" && (
						<Button
							variant={plan.popular ? "hero-outline" : "hero"}
							className="w-full"
							size="lg"
							asChild
						>
							<Link href={action.href}>{action.label}</Link>
						</Button>
					)}

					{action.type === "button" && (
						<Button
							variant={plan.popular ? "hero-outline" : "hero"}
							className="w-full"
							size="lg"
							onClick={action.onClick}
							disabled={action.disabled || action.loading}
						>
							{action.loading && (
								<Loader2 className="size-4 animate-spin mr-2" />
							)}
							{action.label}
						</Button>
					)}

					{action.type === "static" && (
						<Button
							variant={
								isCurrent && !plan.popular
									? "hero"
									: plan.popular
										? "hero-outline"
										: "secondary"
							}
							className={cn(
								"w-full cursor-default disabled:opacity-100",
								isCurrent &&
									plan.popular &&
									"border-primary-foreground bg-primary-foreground text-primary hover:bg-primary-foreground hover:text-primary",
								!isCurrent &&
									!plan.popular &&
									"border-0 bg-primary-100 text-primary hover:bg-primary-100 hover:text-primary",
							)}
							size="lg"
							disabled
						>
							{isCurrent && <Check aria-hidden />}
							{action.label}
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}

export function PlansGrid({
	getAction,
	getBadge,
	animate = true,
	header,
	currentPlanId,
}: {
	getAction: (plan: Plan) => PricingCardAction;
	getBadge?: (plan: Plan) => string | undefined;
	animate?: boolean;
	header?: ReactNode;
	currentPlanId?: PlanId;
}) {
	return (
		<div className="space-y-8">
			{header}
			<div className="gap-8 grid md:grid-cols-2 max-w-3xl mx-auto">
				{PLAN_LIST.map((plan, index) => (
					<PricingCard
						key={plan.id}
						plan={plan}
						index={index}
						action={getAction(plan)}
						badge={getBadge?.(plan)}
						animate={animate}
						isCurrent={plan.id === currentPlanId}
					/>
				))}
			</div>
		</div>
	);
}

export type { PlanId };
