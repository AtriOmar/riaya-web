"use client";

import { ArrowRight, Mail } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

					<div className="relative items-center gap-12 grid lg:grid-cols-2">
						{/* Text Content */}
						<div className="lg:text-left text-center">
							<h2 className="mb-4 font-bold text-primary-foreground text-3xl md:text-4xl">
								Ready to Let AI Fill Your Schedule?
							</h2>
							<p className="mb-8 text-primary-foreground/80 text-lg">
								Join hundreds of doctors across Tunisia who trust Riaya to bring
								patients to their practice. Start receiving AI-matched
								appointments today.
							</p>
							<div className="flex sm:flex-row flex-col justify-center lg:justify-start gap-4">
								<Button variant="hero-outline" size="lg" asChild>
									<Link href="/register">
										Join as a Doctor
										<ArrowRight className="w-5 h-5" />
									</Link>
								</Button>
							</div>
						</div>

						{/* Newsletter Form */}
						<div className="p-8 border border-primary-foreground/20 rounded-2xl bg-primary-foreground/10 backdrop-blur-sm">
							<h3 className="mb-2 font-semibold text-primary-foreground text-xl">
								Stay Updated
							</h3>
							<p className="mb-6 text-primary-foreground/70">
								Subscribe to our newsletter for product updates and healthcare
								insights.
							</p>
							<form className="flex sm:flex-row flex-col gap-3">
								<div className="relative flex-1">
									<Mail className="top-1/2 left-3 absolute w-5 h-5 text-muted-foreground -translate-y-1/2" />
									<Input
										type="email"
										placeholder="Enter your email"
										className="h-12 pl-10 border-border bg-background"
									/>
								</div>
								<Button
									variant="default"
									size="lg"
									className="bg-primary-900 hover:bg-primary-800"
								>
									Subscribe
								</Button>
							</form>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
