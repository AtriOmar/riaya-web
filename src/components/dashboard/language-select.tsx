"use client";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { isLanguage, type Language } from "@/lib/language";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Language; label: string }[] = [
	{ value: "fr", label: "Français" },
	{ value: "en", label: "English" },
	{ value: "ar", label: "العربية" },
];

/** Picks one of the platform languages. */
export default function LanguageSelect({
	value,
	onChange,
	disabled,
	className,
	label,
}: {
	value: Language;
	onChange: (language: Language) => void;
	disabled?: boolean;
	className?: string;
	label: string;
}) {
	return (
		<Select
			value={value}
			onValueChange={(v) => isLanguage(v) && onChange(v)}
			disabled={disabled}
		>
			<SelectTrigger className={cn("w-full", className)} aria-label={label}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{OPTIONS.map((o) => (
					<SelectItem key={o.value} value={o.value}>
						{o.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
