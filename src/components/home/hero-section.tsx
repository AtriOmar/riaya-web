"use client";

import { ArrowRight, Phone, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HeroSection() {
  return (
    <section className="relative flex items-center min-h-screen overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="-top-40 -right-40 absolute w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="-bottom-40 -left-40 absolute w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="mx-auto px-4 pt-24 pb-12 container">
        <div className="items-center gap-12 grid lg:grid-cols-2">
          <div className="lg:text-left text-center" data-aos="fade-right">
            <div
              data-aos="fade-up"
              data-aos-delay="200"
              className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-accent"
            >
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="font-medium text-secondary-foreground text-sm">
                AI-Powered Practice Management
              </span>
            </div>

            <h1
              data-aos="fade-up"
              data-aos-delay="300"
              className="mb-6 font-bold text-4xl md:text-5xl lg:text-6xl leading-tight"
            >
              Let AI Bring <span className="text-gradient">Patients</span> to
              Your Practice
            </h1>

            <p
              data-aos="fade-up"
              data-aos-delay="400"
              className="max-w-xl mx-auto lg:mx-0 mb-8 text-muted-foreground text-lg md:text-xl"
            >
              Riaya handles patient intake through AI phone calls, matches them
              to your specialty, and delivers ready-to-accept appointments
              directly to your dashboard.
            </p>

            <div
              data-aos="fade-up"
              data-aos-delay="500"
              className="flex sm:flex-row flex-col justify-center lg:justify-start gap-4"
            >
              <Button size="lg" asChild>
                <Link href="/register">
                  Join as a Doctor
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <a href="#how-it-works">See How It Works</a>
              </Button>
            </div>

            <div
              data-aos="fade-up"
              data-aos-delay="600"
              className="gap-8 grid grid-cols-3 mt-12"
            >
              {[
                { value: "500+", label: "Doctors" },
                { value: "50K+", label: "Patients Matched" },
                { value: "98%", label: "Acceptance Rate" },
              ].map((stat) => (
                <div key={stat.label} className="lg:text-left text-center">
                  <div className="font-bold text-gradient text-2xl md:text-3xl">
                    {stat.value}
                  </div>
                  <div className="text-muted-foreground text-sm">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div data-aos="fade-left" data-aos-delay="300" className="relative">
            <div className="relative">
              <div className="flex justify-center items-center w-full max-w-lg aspect-square mx-auto rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-soft">
                <Phone className="w-24 h-24 text-primary/50" />
              </div>

              <div
                data-aos="zoom-in"
                data-aos-delay="800"
                className="-bottom-4 -left-4 absolute p-4 rounded-2xl shadow-soft glass"
              >
                <div className="flex items-center gap-3">
                  <div className="flex justify-center items-center w-12 h-12 rounded-full bg-primary/10">
                    <Phone className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold">AI Phone Intake</div>
                    <div className="text-muted-foreground text-sm">
                      Patients call, AI handles the rest
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
