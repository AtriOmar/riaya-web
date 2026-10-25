"use client";

import {
	Bot,
	CheckCircle,
	MessageCircle,
	Phone,
	UserCheck,
} from "lucide-react";

const steps = [
	{
		icon: Phone,
		step: "01",
		title: "Patient Calls Riaya",
		description:
			"A patient dials the Riaya phone number. No app and no account, just a phone call in Derja, French, or English.",
	},
	{
		icon: Bot,
		step: "02",
		title: "AI Asks the Basics",
		description:
			"The AI assistant asks for the reason for the visit, where the patient is, and when they would like to come.",
	},
	{
		icon: UserCheck,
		step: "03",
		title: "Patient Picks a Doctor",
		description:
			"The AI offers the best nearby doctors with a free slot. The patient picks one, and a pending request reaches that doctor.",
	},
	{
		icon: CheckCircle,
		step: "04",
		title: "Doctor Accepts or Refuses",
		description:
			"You see the request live on your calendar and accept or refuse it with one click. You're always in control.",
	},
	{
		icon: MessageCircle,
		step: "05",
		title: "Patient Hears Back",
		description:
			"An accepted visit is confirmed on WhatsApp. If you refuse, or nobody answers in 10 minutes, Riaya contacts the patient to book with another doctor.",
	},
];

export default function HowItWorksSection() {
	return (
		<section id="how-it-works" className="py-24 bg-background">
			<div className="mx-auto px-4 container">
				<div data-aos="fade-up" className="max-w-3xl mx-auto mb-16 text-center">
					<span className="inline-block mb-4 px-4 py-1.5 rounded-full bg-accent font-medium text-secondary-foreground text-sm">
						How It Works
					</span>
					<h2 className="mb-4 font-bold text-3xl md:text-4xl">
						From Phone Call to{" "}
						<span className="text-gradient">Confirmed Appointment</span>
					</h2>
					<p className="text-muted-foreground text-lg">
						Patients call, AI handles intake, and you get ready-to-accept
						appointments. No patient-facing app required.
					</p>
				</div>

				<div className="relative">
					<div
						data-aos="fade-up"
						className="hidden lg:block top-10 right-0 left-0 absolute h-0.5 bg-border -translate-y-1/2"
					/>
					<div className="gap-8 grid md:grid-cols-2 lg:grid-cols-5">
						{steps.map((step, index) => {
							const Icon = step.icon;
							return (
								<div
									key={step.step}
									data-aos="fade-up"
									data-aos-delay={index * 150}
									className="relative"
								>
									<div className="group text-center">
										<div className="inline-flex relative justify-center items-center w-20 h-20 mx-auto mb-6 rounded-2xl bg-linear-to-br from-primary to-primary-700 shadow-medium text-primary-foreground group-hover:rotate-6 group-hover:scale-110 transition-transform duration-300">
											<Icon className="w-8 h-8" />
											<div className="-top-2 -right-2 absolute flex justify-center items-center w-8 h-8 rounded-full bg-accent">
												<span className="font-bold text-secondary-foreground text-xs">
													{step.step}
												</span>
											</div>
										</div>
										<h3 className="mb-3 font-semibold text-lg">{step.title}</h3>
										<p className="text-muted-foreground text-sm">
											{step.description}
										</p>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</section>
	);
}
