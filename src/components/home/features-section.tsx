"use client";

import {
	CalendarDays,
	ClipboardCheck,
	FileText,
	MapPin,
	Phone,
	Truck,
	Upload,
	Users,
} from "lucide-react";

const features = [
	{
		icon: Phone,
		title: "AI Phone Intake",
		description:
			"Patients call Riaya, and our AI collects symptoms, urgency, and location—then creates a pending appointment for you to review.",
	},
	{
		icon: MapPin,
		title: "Smart Doctor Matching",
		description:
			"The AI matches patients to the most suitable doctor based on specialty, location, and availability. You only see relevant appointments.",
	},
	{
		icon: CalendarDays,
		title: "Schedule Management",
		description:
			"Manage your availability with a powerful calendar. View, accept, or decline AI-generated appointments, or create them manually.",
	},
	{
		icon: ClipboardCheck,
		title: "Accept or Decline",
		description:
			"Review incoming AI appointments and accept or decline with one click. You stay in control of your schedule at all times.",
	},
	{
		icon: FileText,
		title: "Consultation Notes & Prescriptions",
		description:
			"Write consultation notes, issue digital prescriptions, and maintain complete patient records within the platform.",
	},
	{
		icon: Upload,
		title: "Document Management",
		description:
			"Attach X-rays, lab reports, and medical scans to patient profiles for easy access during consultations.",
	},
	{
		icon: Users,
		title: "Patient Management",
		description:
			"View patient history, manage recurring appointments, and build lasting patient relationships through your dashboard.",
	},
	{
		icon: Truck,
		title: "Patient Transport Coordination",
		description:
			"Riaya arranges transportation for patients who need it—especially valuable for elderly patients or those with mobility challenges.",
	},
];

export default function FeaturesSection() {
	return (
		<section id="features" className="py-24 bg-gradient-soft">
			<div className="mx-auto px-4 container">
				<div data-aos="fade-up" className="max-w-3xl mx-auto mb-16 text-center">
					<span className="inline-block mb-4 px-4 py-1.5 rounded-full bg-accent font-medium text-secondary-foreground text-sm">
						Features
					</span>
					<h2 className="mb-4 font-bold text-3xl md:text-4xl">
						Everything Doctors Need to{" "}
						<span className="text-gradient">Grow Their Practice</span>
					</h2>
					<p className="text-muted-foreground text-lg">
						Riaya brings patients to you through AI phone calls and gives you
						powerful tools to manage your practice efficiently.
					</p>
				</div>

				<div className="gap-6 grid md:grid-cols-2 lg:grid-cols-4">
					{features.map((feature, index) => {
						const Icon = feature.icon;
						return (
							<div
								key={feature.title}
								data-aos="fade-up"
								data-aos-delay={index * 100}
							>
								<div className="group relative size-full p-6 border border-border/50 rounded-2xl bg-card shadow-soft hover:shadow-medium hover:scale-[1.02] transition-all hover:-translate-y-2 duration-300">
									<div className="absolute inset-0 rounded-2xl bg-linear-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
									<div className="relative">
										<div className="flex justify-center items-center w-14 h-14 mb-4 rounded-xl bg-accent group-hover:rotate-6 group-hover:scale-110 transition-transform duration-300">
											<Icon className="w-7 h-7 text-primary" />
										</div>
										<h3 className="mb-2 font-semibold text-xl">
											{feature.title}
										</h3>
										<p className="text-muted-foreground leading-relaxed">
											{feature.description}
										</p>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</section>
	);
}
