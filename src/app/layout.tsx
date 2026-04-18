import type { Metadata } from "next";
import { Geist, Geist_Mono, Rubik } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/contexts/providers";
import { auth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const rubik = Rubik({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "رعاية",
	description: "Riaya, the AI powered doctor appointments platform",
	metadataBase: new URL(
		process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
	),
	openGraph: {
		title: "رعاية",
		description: "Riaya, the AI powered doctor appointments platform",
		url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
		siteName: "رعاية",
	},
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const initialSession = await auth.api.getSession({
		headers: await headers(),
	});

	return (
		<html lang="en" className={cn("font-sans", rubik.variable)}>
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				<Providers initialSession={initialSession}>
					{children}
					<Toaster position="bottom-right" richColors />
				</Providers>
			</body>
		</html>
	);
}
