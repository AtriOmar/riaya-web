"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/contexts/auth-provider";
import { Button } from "@/components/ui/button";
import UserDropdown from "@/components/user-dropdown";
import { authClient } from "@/lib/auth-client";

const navLinks = [
	{ name: "Home", href: "/" },
	{ name: "Features", href: "/#features" },
	{ name: "How it Works", href: "/#how-it-works" },
	{ name: "Pricing", href: "/#pricing" },
	{ name: "FAQ", href: "/#faq" },
];

export default function Navbar() {
	const [isScrolled, setIsScrolled] = useState(false);
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
	const [mounted, setMounted] = useState(false);
	const { user } = useAuth();

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		const handleScroll = () => setIsScrolled(window.scrollY > 20);
		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	const handleNavClick = (href: string) => {
		setIsMobileMenuOpen(false);
		if (href.startsWith("/#")) {
			const el = document.querySelector(href.substring(1));
			el?.scrollIntoView({ behavior: "smooth" });
		}
	};

	return (
		<header
			className={`
        fixed top-0 left-0 right-0 z-50
        transition-all duration-500
        ${mounted ? "translate-y-0 opacity-100" : "-translate-y-24 opacity-0"}
        ${isScrolled ? "glass shadow-soft" : "bg-transparent"}
      `}
		>
			<div className="mx-auto px-4 container">
				<div className="flex justify-between items-center h-[55px]">
					<Link href="/" className="group flex items-center gap-2">
						<Image
							src="/logo.png"
							alt="Riaya Logo"
							className="group-hover:rotate-6 group-hover:scale-110 transition-transform duration-300"
							width={32}
							height={32}
						/>
						<span className="font-bold text-gradient text-xl">رعاية</span>
					</Link>

					<nav className="hidden md:flex items-center gap-8">
						{navLinks.map((link) => (
							<Link
								key={link.name}
								href={link.href}
								className="group relative font-medium text-foreground/80 hover:text-primary transition-colors"
							>
								{link.name}
								<span className="-bottom-1 left-0 absolute w-0 group-hover:w-full h-0.5 bg-primary transition-all duration-300" />
							</Link>
						))}
					</nav>

					<div className="hidden md:flex items-center gap-3">
						{user ? (
							<UserDropdown user={user} />
						) : (
							<>
								<Button variant="ghost" asChild>
									<Link href="/login">Log in</Link>
								</Button>
								<Button asChild>
									<Link href="/register">Get Started</Link>
								</Button>
							</>
						)}
					</div>

					<button
						type="button"
						onClick={() => setIsMobileMenuOpen((p) => !p)}
						className="md:hidden p-2"
					>
						{isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
					</button>
				</div>
			</div>

			<div
				className={`
          md:hidden overflow-hidden transition-all duration-300
          ${isMobileMenuOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}
          glass border-t border-border
        `}
			>
				<div className="mx-auto px-4 py-4 container">
					<nav className="flex flex-col gap-4">
						{navLinks.map((link) => (
							<a
								key={link.name}
								href={link.href}
								onClick={(e) => {
									e.preventDefault();
									handleNavClick(link.href);
								}}
								className="py-2 font-medium text-foreground/80 hover:text-primary transition-colors"
							>
								{link.name}
							</a>
						))}

						<div className="flex flex-col gap-2 pt-4 border-border border-t">
							{user ? (
								<>
									<Link
										href="/dashboard"
										className="py-2 font-medium text-foreground/80 hover:text-primary transition-colors"
									>
										Dashboard
									</Link>
									<Button
										variant="destructive"
										onClick={() => authClient.signOut()}
									>
										Logout
									</Button>
								</>
							) : (
								<>
									<Button variant="outline" asChild>
										<Link href="/login">Log in</Link>
									</Button>
									<Button asChild>
										<Link href="/register">Get Started</Link>
									</Button>
								</>
							)}
						</div>
					</nav>
				</div>
			</div>
		</header>
	);
}
