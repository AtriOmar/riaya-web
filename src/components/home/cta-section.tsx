"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CTASection() {
  return (
    <section className="py-24 bg-background">
      <div className="mx-auto px-4 container">
        <div
          data-aos="fade-up"
          className="relative overflow-hidden px-8 md:px-16 py-16 rounded-3xl bg-gradient-to-r from-primary to-primary/70 text-primary-foreground text-center"
        >
          <div className="absolute inset-0 opacity-10">
            <div className="-top-20 -right-20 absolute w-80 h-80 rounded-full bg-white/20 blur-3xl" />
            <div className="-bottom-20 -left-20 absolute w-80 h-80 rounded-full bg-white/20 blur-3xl" />
          </div>

          <div className="relative max-w-2xl mx-auto">
            <h2 className="mb-4 font-bold text-3xl md:text-4xl">
              Ready to Grow Your Practice?
            </h2>
            <p className="mb-8 text-primary-foreground/80 text-lg">
              Join hundreds of doctors who are getting more patients through
              AI-powered matching. Start free today.
            </p>
            <div className="flex sm:flex-row flex-col justify-center gap-4">
              <Button size="lg" variant="secondary" asChild>
                <Link href="/register">
                  Get Started Free
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-primary-foreground/30 hover:bg-primary-foreground/10 text-primary-foreground"
                asChild
              >
                <a href="#how-it-works">Learn More</a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
