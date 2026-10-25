"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CTASection() {
	return (
		<section className="py-24 bg-background">
			<div className="mx-auto px-4 container">
				<div
					data-aos="zoom-in"
					className="relative overflow-hidden p-12 md:p-16 rounded-3xl bg-linear-to-br from-primary via-primary-600 to-primary-700"
				>
					{/* Background decoration */}
					<div className="absolute inset-0 overflow-hidden">
						<div className="-top-20 -right-20 absolute w-64 h-64 rounded-full bg-primary-foreground/10 blur-3xl" />
						<div className="-bottom-20 -left-20 absolute w-64 h-64 rounded-full bg-primary-foreground/10 blur-3xl" />
					</div>

					<div className="relative max-w-2xl mx-auto text-center">
						<h2 className="mb-4 font-bold text-primary-foreground text-3xl md:text-4xl">
							Ready to Let AI Fill Your Schedule?
						</h2>
						<p className="mb-8 text-primary-foreground/80 text-lg">
							Join doctors across Tunisia who get patients from Riaya's phone
							assistant. Sign up for free, and once your profile is verified,
							you start receiving booking requests.
						</p>
						<div className="flex sm:flex-row flex-col justify-center gap-4">
							<Button variant="hero-outline" size="lg" asChild>
								<Link href="/register">
									Join as a Doctor
									<ArrowRight className="w-5 h-5" />
								</Link>
							</Button>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
