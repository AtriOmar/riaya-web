"use client";

import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Starter",
    price: "Free",
    period: "",
    description: "Get started with AI patient matching",
    features: [
      "AI phone intake",
      "Up to 20 appointments/month",
      "Basic calendar",
      "Patient profiles",
      "Email support",
    ],
    cta: "Get Started Free",
    popular: false,
  },
  {
    name: "Professional",
    price: "49",
    period: "/month",
    description: "For growing practices",
    features: [
      "Everything in Starter",
      "Unlimited appointments",
      "Advanced scheduling",
      "Consultation notes",
      "Priority support",
      "Analytics dashboard",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For clinics and hospital networks",
    features: [
      "Everything in Professional",
      "Multi-doctor support",
      "Custom integrations",
      "Dedicated account manager",
      "SLA guarantee",
      "Custom AI training",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

export default function PricingSection() {
  return (
    <section id="pricing" className="py-24 bg-background">
      <div className="mx-auto px-4 container">
        <div data-aos="fade-up" className="max-w-3xl mx-auto mb-16 text-center">
          <span className="inline-block mb-4 px-4 py-1.5 rounded-full bg-accent font-medium text-secondary-foreground text-sm">
            Pricing
          </span>
          <h2 className="mb-4 font-bold text-3xl md:text-4xl">
            Simple, <span className="text-gradient">Transparent</span> Pricing
          </h2>
          <p className="text-muted-foreground text-lg">
            Start free and scale as your practice grows.
          </p>
        </div>

        <div className="gap-8 grid md:grid-cols-3 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <div
              key={plan.name}
              data-aos="fade-up"
              data-aos-delay={i * 150}
              className={`relative p-8 rounded-2xl border transition-all duration-300 hover:-translate-y-2 ${
                plan.popular
                  ? "border-primary bg-card shadow-lg scale-105"
                  : "border-border/50 bg-card shadow-soft"
              }`}
            >
              {plan.popular && (
                <div className="-top-4 left-1/2 absolute px-4 py-1 rounded-full bg-primary font-medium text-primary-foreground text-sm -translate-x-1/2">
                  Most Popular
                </div>
              )}

              <h3 className="font-semibold text-xl">{plan.name}</h3>
              <p className="mt-2 text-muted-foreground text-sm">
                {plan.description}
              </p>

              <div className="mt-6 mb-6">
                <span className="font-bold text-4xl">
                  {plan.price === "Free" || plan.price === "Custom"
                    ? plan.price
                    : `$${plan.price}`}
                </span>
                {plan.period && (
                  <span className="text-muted-foreground">{plan.period}</span>
                )}
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                variant={plan.popular ? "default" : "outline"}
                className="w-full"
                asChild
              >
                <Link href="/register">
                  {plan.cta}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
