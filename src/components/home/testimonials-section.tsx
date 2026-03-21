"use client";

import { Quote, Star } from "lucide-react";

const testimonials = [
  {
    content:
      "Riaya has transformed my practice. I no longer chase patients—they come to me through AI matching. My schedule is fuller and more organized than ever.",
    author: "Dr. Amira Ben Salah",
    role: "General Practitioner, Tunis",
    rating: 5,
  },
  {
    content:
      "The AI phone intake is brilliant. Patients call, the AI gathers everything I need, and I just accept the appointment. It's like having a 24/7 receptionist.",
    author: "Dr. Mohamed Trabelsi",
    role: "Cardiologist, Sfax",
    rating: 5,
  },
  {
    content:
      "I was skeptical at first, but Riaya brought me 30% more patients in the first month. The smart matching ensures I only see patients relevant to my specialty.",
    author: "Dr. Salma Gharbi",
    role: "Dermatologist, Sousse",
    rating: 5,
  },
];

export default function TestimonialsSection() {
  return (
    <section className="py-24 bg-muted/30">
      <div className="mx-auto px-4 container">
        <div data-aos="fade-up" className="max-w-3xl mx-auto mb-16 text-center">
          <span className="inline-block mb-4 px-4 py-1.5 rounded-full bg-accent font-medium text-secondary-foreground text-sm">
            Testimonials
          </span>
          <h2 className="mb-4 font-bold text-3xl md:text-4xl">
            Trusted by <span className="text-gradient">Doctors</span> Across
            Tunisia
          </h2>
        </div>

        <div className="gap-8 grid md:grid-cols-3">
          {testimonials.map((t, i) => (
            <div
              key={t.author}
              data-aos="fade-up"
              data-aos-delay={i * 150}
              className="relative p-8 border border-border/50 rounded-2xl bg-card shadow-soft"
            >
              <Quote className="w-8 h-8 mb-4 text-primary/30" />
              <div className="flex gap-1 mb-4">
                {Array.from({ length: t.rating }).map((_, j) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: generated array of identical star icons has no stable identifier
                  <Star key={j} className="w-4 h-4 fill-primary text-primary" />
                ))}
              </div>
              <p className="mb-6 text-foreground leading-relaxed">
                {t.content}
              </p>
              <div>
                <div className="font-semibold">{t.author}</div>
                <div className="text-muted-foreground text-sm">{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
