"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "How does the AI phone intake work?",
    a: "Patients simply call the Riaya phone number. Our AI assistant conducts a natural conversation to collect symptoms, urgency level, preferred location, and available times. The AI then creates a pending appointment with the best-matched doctor.",
  },
  {
    q: "Do patients need to download an app?",
    a: "No! Patients just make a regular phone call. No app download, no account creation. This makes healthcare accessible to everyone, including elderly patients.",
  },
  {
    q: "How does doctor matching work?",
    a: "Our AI considers specialty match, geographic proximity, doctor availability, and patient urgency. It selects the best-fit doctor and creates a pending appointment for review.",
  },
  {
    q: "Can I decline AI-generated appointments?",
    a: "Absolutely. You have full control. Every AI-generated appointment appears as 'pending' in your dashboard. You can accept or decline with one click.",
  },
  {
    q: "Is my patient data secure?",
    a: "Yes. We use end-to-end encryption and comply with healthcare data regulations. Your patient data is stored securely and never shared without consent.",
  },
  {
    q: "What about the patient transport feature?",
    a: "For patients who need it (especially elderly or mobility-challenged), Riaya can arrange transportation to your cabinet. This is an optional feature that improves patient access.",
  },
];

export default function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 bg-muted/30">
      <div className="max-w-3xl mx-auto px-4 container">
        <div data-aos="fade-up" className="mb-16 text-center">
          <span className="inline-block mb-4 px-4 py-1.5 rounded-full bg-accent font-medium text-secondary-foreground text-sm">
            FAQ
          </span>
          <h2 className="mb-4 font-bold text-3xl md:text-4xl">
            Frequently Asked <span className="text-gradient">Questions</span>
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div
              key={faq.q}
              data-aos="fade-up"
              data-aos-delay={i * 80}
              className="overflow-hidden border border-border/50 rounded-xl bg-card"
            >
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                className="flex justify-between items-center w-full p-5 hover:bg-muted/50 font-medium text-left transition"
              >
                {faq.q}
                <ChevronDown
                  className={cn(
                    "w-5 h-5 text-muted-foreground transition-transform duration-200 shrink-0",
                    open === i && "rotate-180",
                  )}
                />
              </button>
              <div
                className={cn(
                  "overflow-hidden transition-all duration-300",
                  open === i ? "max-h-96 pb-5 px-5" : "max-h-0",
                )}
              >
                <p className="text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
