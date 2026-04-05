import CTASection from "@/components/home/cta-section";
import FAQSection from "@/components/home/faq-section";
import FeaturesSection from "@/components/home/features-section";
import Footer from "@/components/home/footer";
import HeroSection from "@/components/home/hero-section";
import HowItWorksSection from "@/components/home/how-it-works-section";
import PricingSection from "@/components/home/pricing-section";
import TestimonialsSection from "@/components/home/testimonials-section";

export default function HomePage() {
	return (
		<div>
			<HeroSection />
			<FeaturesSection />
			<HowItWorksSection />
			<TestimonialsSection />
			<PricingSection />
			<FAQSection />
			<CTASection />
			<Footer />
		</div>
	);
}
