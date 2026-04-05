"use client";

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
	{
		question: "How does the AI assign patients to me?",
		answer:
			"When a patient calls Riaya, our AI collects their symptoms, location, and urgency level. Based on your specialty, availability, and proximity to the patient, the AI matches them to the most suitable doctor. You'll receive a pending appointment with all the details.",
	},
	{
		question: "Can I decline appointments?",
		answer:
			"Absolutely. Every AI-generated appointment arrives as a pending request. You can review the patient details, symptoms, and timing—then accept or decline with one click. You're always in control of your schedule.",
	},
	{
		question: "Do patients need to use an app?",
		answer:
			"No. Patients interact with Riaya entirely through phone calls. They simply dial our number, speak with the AI assistant, and receive confirmation of their appointment. No app download or account creation required.",
	},
	{
		question: "Can I create appointments manually?",
		answer:
			"Yes. While Riaya excels at AI-generated appointments, you can also create appointments manually through the large calendar in your dashboard. This is useful for walk-ins or returning patients who contact you directly.",
	},
	{
		question: "How does patient transport work?",
		answer:
			"When a patient needs transportation to your cabinet, Riaya coordinates the logistics. This is especially valuable for elderly patients or those with mobility challenges. You'll see transport status in the appointment details.",
	},
	{
		question: "Is my patient data secure?",
		answer:
			"Riaya uses enterprise-grade encryption and complies with healthcare data protection regulations. All patient records, consultation notes, and documents are stored securely and accessible only to authorized healthcare providers.",
	},
	{
		question: "What documents can I attach to patient profiles?",
		answer:
			"You can upload X-rays, lab reports, prescriptions, medical scans, and other relevant files. Supported formats include PDF, JPG, PNG, and DICOM for medical imaging. All documents are organized by patient for easy access.",
	},
	{
		question: "How do I manage my availability?",
		answer:
			"Your dashboard includes a powerful calendar where you set your working hours, block off time, and manage your availability. The AI only assigns patients when you're available, respecting your schedule preferences.",
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
