"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
	const { resolvedTheme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const isDark = resolvedTheme === "dark";

	const toggleTheme = () => {
		setTheme(isDark ? "light" : "dark");
	};

	if (!mounted) {
		return (
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className={cn(
					"size-9 rounded-full text-foreground/80 hover:text-foreground",
					className,
				)}
				disabled
				aria-label="Toggle theme"
			>
				<Sun className="size-4 opacity-50" />
			</Button>
		);
	}

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			onClick={toggleTheme}
			className={cn(
				"size-9 rounded-full text-foreground/80 hover:text-foreground hover:bg-muted transition-colors relative",
				className,
			)}
			aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
			title={isDark ? "Switch to light theme" : "Switch to dark theme"}
		>
			<Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-amber-500 dark:text-foreground" />
			<Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-foreground dark:text-emerald-400" />
			<span className="sr-only">Toggle theme</span>
		</Button>
	);
}

export default ThemeToggle;
