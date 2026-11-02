"use client";

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
	{
		question: "How do patients reach me through Riaya?",
		answer:
			"When a patient calls Riaya, the AI asks for the reason for the visit, where they are, and when they would like to come. It then offers the closest doctors of the right specialty who have a free slot. If the patient picks you, you receive a pending request with the patient, the reason, and the time.",
	},
	{
		question: "Can I refuse a request?",
		answer:
			"Yes. Every phone booking arrives as a pending request, and you accept or refuse it with one click. If you refuse, or don't answer within 10 minutes, the request is cancelled and Riaya contacts the patient to book with another doctor.",
	},
	{
		question: "Do patients need to use an app?",
		answer:
			"No. Patients only use the phone and WhatsApp. They call our number and speak with the AI assistant in Tunisian Derja, French, or English. Once you accept, they get a confirmation on WhatsApp. No app download or account needed.",
	},
	{
		question: "What about urgent cases?",
		answer:
			"For signs of a life-threatening emergency, the AI first tells the patient to call the SAMU at 190. For urgent cases, it can send a request to up to 3 nearby doctors at once. They are marked urgent on your calendar, and the first doctor to accept keeps the appointment.",
	},
	{
		question: "Can I create appointments myself?",
		answer:
			"Yes. You can add appointments directly on your calendar, for walk-ins or returning patients who contact you directly. They are confirmed right away.",
	},
	{
		question: "Who can see my patients' files?",
		answer:
			"Only you. If you add secretaries on the Pro plan, they can manage your appointments, patients, and invoices, but they never see medical files or recordings.",
	},
	{
		question: "What can I attach to a patient's file?",
		answer:
			"Consultations, prescriptions, and lab reports, each with up to 10 documents (PDF, images, or Word) of up to 20 MB. You can send a file to the patient on WhatsApp in one click.",
	},
	{
		question: "How do I manage my availability?",
		answer:
			"Set your weekly working hours on the Availability page: which days you work and your hours on each day. The AI only offers patients times inside those hours that are still free on your calendar.",
	},
];

export default function FAQSection() {
	return (
		<section id="faq" className="py-24 bg-background">
			<div className="mx-auto px-4 container">
				{/* Section Header */}
				<div data-aos="fade-up" className="max-w-3xl mx-auto mb-16 text-center">
					<span className="inline-block mb-4 px-4 py-1.5 rounded-full bg-accent font-medium text-secondary-foreground text-sm">
						FAQ
					</span>
					<h2 className="mb-4 font-bold text-foreground text-3xl md:text-4xl">
						Questions from <span className="text-gradient">Doctors</span>
					</h2>
					<p className="text-muted-foreground text-lg">
						Everything you need to know about using Riaya to grow your practice
						and manage appointments.
					</p>
				</div>

				{/* FAQ Accordion */}
				<div className="max-w-3xl mx-auto">
					<Accordion type="single" collapsible className="space-y-4">
						{faqs.map((faq, index) => (
							<AccordionItem
								key={faq.question}
								value={`item-${index}`}
								className="px-6 border border-border rounded-xl bg-card data-[state=open]:shadow-soft transition-shadow duration-300"
								data-aos="fade-up"
								data-aos-delay={index * 100}
							>
								<AccordionTrigger className="py-6 font-semibold text-card-foreground hover:text-primary text-left hover:no-underline">
									{faq.question}
								</AccordionTrigger>
								<AccordionContent className="pb-6 text-muted-foreground">
									{faq.answer}
								</AccordionContent>
							</AccordionItem>
						))}
					</Accordion>
				</div>
			</div>
		</section>
	);
}
