"use client";

import { Quote, Star } from "lucide-react";
import Image from "next/image";
import doctor1 from "@/assets/doctor-1.png";
import doctor2 from "@/assets/doctor-2.png";

const testimonials = [
	{
		content:
			"Riaya has transformed my practice. I no longer chase patients—they come to me through AI matching. My schedule is fuller and more organized than ever.",
		author: "Dr. Amira Ben Salah",
		role: "General Practitioner, Tunis",
		avatar: doctor1,
		rating: 5,
	},
	{
		content:
			"The AI phone intake is brilliant. Patients call, the AI gathers everything I need, and I just accept the appointment. It's like having a 24/7 receptionist.",
		author: "Dr. Mohamed Trabelsi",
		role: "Cardiologist, Sfax",
		avatar: doctor2,
		rating: 5,
	},
	{
		content:
			"The transport coordination is invaluable for my elderly patients. They get to their appointments safely, and I can focus on providing care instead of logistics.",
		author: "Dr. Fatma Khelifi",
		role: "Family Medicine, Sousse",
		avatar: doctor1,
		rating: 5,
	},
];

function TestimonialCard({
	testimonial,
	index,
}: {
	testimonial: (typeof testimonials)[number];
	index: number;
}) {
	return (
		<div data-aos="fade-up" data-aos-delay={index * 100}>
			<div className="relative p-8 border border-border/50 rounded-2xl bg-card shadow-soft hover:shadow-medium transition-all hover:-translate-y-2 duration-300">
				{/* Quote Icon */}
				<div className="-top-4 left-6 absolute">
					<div className="flex justify-center items-center w-10 h-10 rounded-full bg-primary">
						<Quote className="w-5 h-5 text-primary-foreground" />
					</div>
				</div>

				{/* Rating */}
				<div className="flex gap-1 mb-4 pt-4">
					{Array.from({ length: testimonial.rating }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: generated array of identical star icons has no stable identifier
						<Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
					))}
				</div>

				{/* Content */}
				<p className="mb-6 text-muted-foreground leading-relaxed">
					&ldquo;{testimonial.content}&rdquo;
				</p>

				{/* Author */}
				<div className="flex items-center gap-4">
					<Image
						src={testimonial.avatar}
						alt={testimonial.author}
						className="object-cover border-2 border-accent rounded-full hover:scale-110 transition-transform duration-300"
						width={48}
						height={48}
					/>
					<div>
						<div className="font-semibold text-card-foreground">
							{testimonial.author}
						</div>
						<div className="text-muted-foreground text-sm">
							{testimonial.role}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default function TestimonialsSection() {
	return (
		<section className="py-24 bg-gradient-soft">
			<div className="mx-auto px-4 container">
				{/* Header */}
				<div data-aos="fade-up" className="max-w-3xl mx-auto mb-16 text-center">
					<span className="inline-block mb-4 px-4 py-1.5 rounded-full bg-accent font-medium text-secondary-foreground text-sm">
						Testimonials
					</span>

					<h2 className="mb-4 font-bold text-3xl md:text-4xl">
						Trusted by{" "}
						<span className="text-gradient">Doctors Across Tunisia</span>
					</h2>

					<p className="text-muted-foreground text-lg">
						See how healthcare professionals are growing their practices with
						Riaya.
					</p>
				</div>

				{/* Grid */}
				<div className="gap-8 grid md:grid-cols-3">
					{testimonials.map((testimonial, index) => (
						<TestimonialCard
							key={testimonial.author}
							testimonial={testimonial}
							index={index}
						/>
					))}
				</div>
			</div>
		</section>
	);
}
