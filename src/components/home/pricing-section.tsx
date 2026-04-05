"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const plans = [
	{
		name: "Basic",
		description: "For individual practitioners",
		price: "12",
		period: "/month",
		features: [
			"AI appointment matching",
			"Up to 50 appointments/month",
			"Calendar & schedule management",
			"Patient records",
			"Email support",
		],
		popular: false,
		cta: "Get Started",
	},
	{
		name: "Pro",
		description: "For growing practices",
		price: "25",
		period: "/month",
		features: [
			"Unlimited AI appointments",
			"Priority patient matching",
			"Consultation notes & prescriptions",
			"Document storage (10GB)",
			"Patient transport coordination",
			"Priority support",
			"Analytics dashboard",
		],
		popular: true,
		cta: "Start Pro Trial",
	},
	{
		name: "Clinic",
		description: "For medical centers & clinics",
		price: "40",
		period: "/month",
		features: [
			"Everything in Pro",
			"Multi-doctor management",
			"Shared patient records",
			"Unlimited document storage",
			"Advanced analytics",
			"Dedicated account manager",
			"Custom integrations",
		],
		popular: false,
		cta: "Contact Sales",
	},
];

function PricingCard({
	plan,
	index,
}: {
	plan: (typeof plans)[number];
	index: number;
}) {
	return (
		<div data-aos="fade-up" data-aos-delay={index * 100}>
			<div
				className={`
        relative rounded-2xl p-8 transition-all duration-300 hover:-translate-y-2 size-full
        ${
					plan.popular
						? "bg-linear-to-br from-primary to-primary-700 text-primary-foreground shadow-glow"
						: "bg-card border border-border shadow-soft"
				}
        `}
			>
				{plan.popular && (
					<div className="-top-4 left-1/2 absolute px-4 py-1 rounded-full bg-accent font-semibold text-secondary-foreground text-sm -translate-x-1/2">
						Most Popular
					</div>
				)}

				{/* Header */}
				<div className="mb-8 text-center">
					<h3
						className={`text-xl font-semibold mb-2 ${
							plan.popular ? "" : "text-card-foreground"
						}`}
					>
						{plan.name}
					</h3>
					<p
						className={`text-sm mb-4 ${
							plan.popular
								? "text-primary-foreground/80"
								: "text-muted-foreground"
						}`}
					>
						{plan.description}
					</p>
					<div className="flex justify-center items-baseline gap-1">
						<span
							className={`text-lg ${
								plan.popular ? "" : "text-muted-foreground"
							}`}
						>
							TND
						</span>
						<span className="font-bold text-4xl">{plan.price}</span>
						<span
							className={
								plan.popular
									? "text-primary-foreground/80"
									: "text-muted-foreground"
							}
						>
							{plan.period}
						</span>
					</div>
				</div>

				{/* Features */}
				<ul className="space-y-4 mb-8">
					{plan.features.map((feature) => (
						<li key={feature} className="flex items-start gap-3">
							<div
								className={`
                w-5 h-5 rounded-full flex items-center justify-center shrink-0
                ${plan.popular ? "bg-primary-foreground/20" : "bg-accent"}
                `}
							>
								<Check
									className={`w-3 h-3 ${
										plan.popular ? "text-primary-foreground" : "text-primary"
									}`}
								/>
							</div>
							<span
								className={`text-sm ${
									plan.popular
										? "text-primary-foreground/90"
										: "text-muted-foreground"
								}`}
							>
								{feature}
							</span>
						</li>
					))}
				</ul>

				{/* CTA */}
				<Button
					variant={plan.popular ? "hero-outline" : "hero"}
					className="w-full"
					size="lg"
					asChild
				>
					<Link href="/register">{plan.cta}</Link>
				</Button>
			</div>
		</div>
	);
}

export default function PricingSection() {
	return (
		<section id="pricing" className="py-24 bg-gradient-soft">
			<div className="mx-auto px-4 container">
				{/* Header */}
				<div data-aos="fade-up" className="max-w-3xl mx-auto mb-16 text-center">
					<span className="inline-block mb-4 px-4 py-1.5 rounded-full bg-accent font-medium text-secondary-foreground text-sm">
						Pricing
					</span>
					<h2 className="mb-4 font-bold text-3xl md:text-4xl">
						Plans for <span className="text-gradient">Every Practice</span>
					</h2>
					<p className="text-muted-foreground text-lg">
						Choose the plan that fits your practice. All plans include our core
						AI appointment matching.
					</p>
				</div>

				{/* Cards */}
				<div className="gap-8 grid md:grid-cols-3 max-w-5xl mx-auto">
					{plans.map((plan, index) => (
						<PricingCard key={plan.name} plan={plan} index={index} />
					))}
				</div>
			</div>
		</section>
	);
}
