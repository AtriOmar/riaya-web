"use client";

import { PlansGrid } from "@/components/plans/plans-grid";
import type { Plan } from "@/lib/plans";

export default function PricingSection() {
	return (
		<section id="pricing" className="py-24 bg-gradient-soft">
			<div className="mx-auto px-4 container">
				<div data-aos="fade-up" className="max-w-3xl mx-auto mb-16 text-center">
					<span className="inline-block mb-4 px-4 py-1.5 rounded-full bg-accent font-medium text-secondary-foreground text-sm">
						Pricing
					</span>
					<h2 className="mb-4 font-bold text-3xl md:text-4xl">
						Simple plans for{" "}
						<span className="text-gradient">every practice</span>
					</h2>
					<p className="text-muted-foreground text-lg">
						Start free with full practice tools. Upgrade to Pro when you want
						unlimited AI booking and WhatsApp.
					</p>
				</div>

				<PlansGrid
					getAction={(plan: Plan) => ({
						type: "link",
						href: "/register",
						label: plan.cta,
					})}
				/>
			</div>
		</section>
	);
}
