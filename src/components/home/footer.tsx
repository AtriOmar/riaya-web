import {
	Facebook,
	Instagram,
	Linkedin,
	Mail,
	MapPin,
	Phone,
	Twitter,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const footerLinks = {
	product: [
		{ name: "Features", href: "/#features" },
		{ name: "Pricing", href: "/#pricing" },
		{ name: "FAQ", href: "/#faq" },
	],
	company: [
		{ name: "About Us", href: "#" },
		{ name: "Careers", href: "#" },
		{ name: "Press", href: "#" },
	],
	legal: [
		{ name: "Privacy Policy", href: "#" },
		{ name: "Terms of Service", href: "#" },
		{ name: "Cookie Policy", href: "#" },
	],
};

const socialLinks = [
	{ icon: Facebook, href: "#" },
	{ icon: Twitter, href: "#" },
	{ icon: Instagram, href: "#" },
	{ icon: Linkedin, href: "#" },
];

export default function Footer() {
	return (
		<footer className="bg-primary-900 text-primary-100">
			<div className="mx-auto px-4 py-16 container">
				<div className="gap-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5">
					{/* Brand */}
					<div className="lg:col-span-2">
						<Link href="/" className="flex items-center gap-2 mb-4">
							<Image src="/logo.png" alt="Riaya" width={40} height={40} />
							<span className="font-bold text-primary-50 text-2xl">Riaya</span>
						</Link>
						<p className="max-w-sm mb-6 text-primary-300">
							Your AI-powered healthcare companion. Book appointments, manage
							your health, and connect with doctors seamlessly in Tunisia.
						</p>
						<div className="flex gap-4">
							{socialLinks.map((social) => {
								const IconComponent = social.icon;
								return (
									<a
										key={social.href}
										href={social.href}
										className="flex justify-center items-center w-10 h-10 rounded-full bg-primary-800 hover:bg-primary text-primary-300 hover:text-primary-foreground hover:scale-110 transition-all hover:-translate-y-0.5 duration-300"
									>
										<IconComponent size={18} />
									</a>
								);
							})}
						</div>
					</div>

					{/* Product Links */}
					<div>
						<h4 className="mb-4 font-semibold text-primary-50">Product</h4>
						<ul className="space-y-3">
							{footerLinks.product.map((link) => (
								<li key={link.name}>
									<a
										href={link.href}
										className="text-primary-300 hover:text-primary-50 transition-colors duration-200"
									>
										{link.name}
									</a>
								</li>
							))}
						</ul>
					</div>

					{/* Company Links */}
					<div>
						<h4 className="mb-4 font-semibold text-primary-50">Company</h4>
						<ul className="space-y-3">
							{footerLinks.company.map((link) => (
								<li key={link.name}>
									<a
										href={link.href}
										className="text-primary-300 hover:text-primary-50 transition-colors duration-200"
									>
										{link.name}
									</a>
								</li>
							))}
						</ul>
					</div>

					{/* Contact */}
					<div>
						<h4 className="mb-4 font-semibold text-primary-50">Contact</h4>
						<ul className="space-y-3">
							<li className="flex items-center gap-3 text-primary-300">
								<MapPin size={16} />
								<span>Tunis, Tunisia</span>
							</li>
							<li className="flex items-center gap-3 text-primary-300">
								<Phone size={16} />
								<span>+216 XX XXX XXX</span>
							</li>
							<li className="flex items-center gap-3 text-primary-300">
								<Mail size={16} />
								<span>contact@riaya.tn</span>
							</li>
						</ul>
					</div>
				</div>

				{/* Bottom Bar */}
				<div className="mt-12 pt-8 border-primary-800 border-t">
					<div className="flex md:flex-row flex-col justify-between items-center gap-4">
						<p className="text-primary-400 text-sm">
							© {new Date().getFullYear()} Riaya. All rights reserved.
						</p>
						<div className="flex gap-6">
							{footerLinks.legal.map((link) => (
								<a
									key={link.name}
									href={link.href}
									className="text-primary-400 hover:text-primary-200 text-sm transition-colors duration-200"
								>
									{link.name}
								</a>
							))}
						</div>
					</div>
				</div>
			</div>
		</footer>
	);
}
