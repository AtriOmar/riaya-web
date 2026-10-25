"use client";

import {
	CalendarDays,
	ClipboardCheck,
	FileText,
	MapPin,
	Mic,
	Phone,
	Receipt,
	Sparkles,
} from "lucide-react";

const features = [
	{
		icon: Phone,
		title: "AI Phone Booking",
		description:
			"Patients call Riaya and talk to an AI assistant in Tunisian Derja, French, or English. It asks for the reason, the area, and a preferred time.",
	},
	{
		icon: MapPin,
		title: "Nearby Doctors First",
		description:
			"The AI offers the patient the closest doctors of the right specialty who have a free slot. The patient picks one and you get the request.",
	},
	{
		icon: ClipboardCheck,
		title: "Accept or Refuse",
		description:
			"Phone bookings arrive live on your calendar as pending requests. Accept or refuse in one click, and Riaya tells the patient on WhatsApp.",
	},
	{
		icon: CalendarDays,
		title: "Calendar & Availability",
		description:
			"Set your weekly working hours and manage every appointment on one calendar. Add walk-ins and returning patients yourself.",
	},
	{
		icon: FileText,
		title: "Patient Files",
		description:
			"Keep each patient's history, consultations, prescriptions, and lab reports in one place, and send them to the patient on WhatsApp.",
	},
	{
		icon: Mic,
		title: "Consultation Recordings",
		description:
			"Record a consultation and get a transcript. On Pro, Riaya also writes a consultation note from it.",
	},
	{
		icon: Receipt,
		title: "Invoices & Payments",
		description:
			"Create invoices, record cash or transfer payments, and send the PDF to your patient on WhatsApp.",
	},
	{
		icon: Sparkles,
		title: "AI Assistant",
		description:
			"Ask questions about your practice, your schedule, or a transcript. The assistant is one shortcut away on every page.",
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
