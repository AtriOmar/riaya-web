"use client";

import { Bot, Car, CheckCircle, Phone, UserCheck } from "lucide-react";

const steps = [
  {
    icon: Phone,
    step: "01",
    title: "Patient Calls Riaya",
    description:
      "A patient dials the Riaya phone number. No app needed—just a simple phone call.",
  },
  {
    icon: Bot,
    step: "02",
    title: "AI Collects Information",
    description:
      "Our AI gathers symptoms, urgency level, preferred location, and availability.",
  },
  {
    icon: UserCheck,
    step: "03",
    title: "Doctor is Matched",
    description:
      "Based on specialty, location, and availability, the AI selects the most suitable doctor.",
  },
  {
    icon: CheckCircle,
    step: "04",
    title: "Doctor Accepts",
    description:
      "You review the appointment details and accept or decline with one click.",
  },
  {
    icon: Car,
    step: "05",
    title: "Patient Transport",
    description:
      "If needed, Riaya arranges transportation to bring the patient to your cabinet.",
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
            appointments.
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
                    <div className="inline-flex relative justify-center items-center w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-lg text-primary-foreground group-hover:rotate-6 group-hover:scale-110 transition-transform duration-300">
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
