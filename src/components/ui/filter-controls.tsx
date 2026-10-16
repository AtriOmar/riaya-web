"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Shared filter controls. Every list/page filter (search, dropdown, combobox,
 * segmented) uses the same height, radius and border so they read as one set.
 */
const CONTROL =
	"h-10 rounded-md border border-border bg-card font-normal text-foreground";

type Icon = React.ComponentType<{ className?: string }>;

export function FilterSearch({
	value,
	onChange,
	placeholder,
	className,
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	className?: string;
}) {
	return (
		<div className={cn("relative w-full sm:max-w-xs", className)}>
			<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				aria-label={placeholder}
				placeholder={placeholder}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="h-10 rounded-md border-border bg-card pl-9"
			/>
		</div>
	);
}

function FilterTriggerBody({
	icon: Icon,
	children,
}: {
	icon?: Icon;
	children: ReactNode;
}) {
	return (
		<>
			<span className="inline-flex min-w-0 items-center gap-2">
				{Icon ? <Icon className="size-4 shrink-0" /> : null}
				<span className="truncate">{children}</span>
			</span>
			<ChevronDown className="size-4 shrink-0 opacity-70" />
		</>
	);
}

export type FilterOption = {
	value: string;
	label: string;
	/** Tailwind class for a small colored dot, e.g. "bg-green-500". */
	dot?: string;
};

/** Small fixed list (status, role…). Opens a radio dropdown. */
export function FilterSelect({
	icon,
	label,
	value,
	onValueChange,
	options,
	className,
}: {
	icon?: Icon;
	label: string;
	value: string;
	onValueChange: (value: string) => void;
	options: FilterOption[];
	className?: string;
}) {
	const selected = options.find((o) => o.value === value);
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="quiet"
					aria-label={label}
					className={cn(
						CONTROL,
						"min-w-[11.5rem] justify-between px-3",
						className,
					)}
				>
					<FilterTriggerBody icon={icon}>
						{selected?.label ?? label}
					</FilterTriggerBody>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start">
				<DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
					{options.map((o) => (
						<DropdownMenuRadioItem key={o.value} value={o.value}>
							{o.dot ? (
								<span className={cn("size-2 rounded-full", o.dot)} />
							) : null}
							{o.label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export type FilterComboboxOption = {
	id: number | string;
	label: string;
	/** Extra text matched by the search box. */
	keywords?: string;
};

/** Long / searchable list (specialities, cities…). Popover + Command. */
export function FilterCombobox({
	icon,
	placeholder,
	searchPlaceholder,
	emptyText,
	options,
	selectedId,
	onSelect,
	loading,
	displayLabel,
	className,
}: {
	icon?: Icon;
	placeholder: string;
	searchPlaceholder: string;
	emptyText: string;
	options: FilterComboboxOption[];
	selectedId: number | string | null;
	onSelect: (option: FilterComboboxOption) => void;
	loading?: boolean;
	/** Overrides the text shown in the trigger (e.g. "Tunis · pin"). */
	displayLabel?: string | null;
	className?: string;
}) {
	const [open, setOpen] = useState(false);
	const selected = options.find((o) => o.id === selectedId);
	const text =
		displayLabel ?? selected?.label ?? (loading ? "Loading…" : placeholder);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="quiet"
					role="combobox"
					aria-expanded={open}
					aria-label={placeholder}
					className={cn(
						CONTROL,
						"min-w-[11.5rem] justify-between px-3",
						className,
					)}
				>
					<FilterTriggerBody icon={icon}>{text}</FilterTriggerBody>
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-72 p-0" align="start">
				<Command>
					<CommandInput placeholder={searchPlaceholder} />
					<CommandList>
						<CommandEmpty>{emptyText}</CommandEmpty>
						<CommandGroup>
							{options.map((o) => (
								<CommandItem
									key={o.id}
									value={`${o.label} ${o.keywords ?? ""}`}
									onSelect={() => {
										onSelect(o);
										setOpen(false);
									}}
								>
									<Check
										className={cn(
											"size-4",
											o.id === selectedId ? "opacity-100" : "opacity-0",
										)}
									/>
									<span className="truncate">{o.label}</span>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

/** 2–4 mutually exclusive views (all/active/ended, calendar/map). */
export function FilterSegmented<T extends string>({
	value,
	onChange,
	options,
	className,
}: {
	value: T;
	onChange: (value: T) => void;
	options: { value: T; label: ReactNode; icon?: Icon }[];
	className?: string;
}) {
	return (
		<div
			className={cn(
				"inline-flex h-10 items-stretch gap-1 rounded-md border border-border bg-muted/60 p-1",
				className,
			)}
		>
			{options.map(({ value: v, label, icon: Icon }) => (
				<button
					key={v}
					type="button"
					aria-pressed={value === v}
					onClick={() => onChange(v)}
					className={cn(
						"inline-flex items-center gap-1.5 rounded-sm px-3 text-sm font-medium capitalize transition-colors",
						value === v
							? "bg-background text-foreground shadow-sm"
							: "text-muted-foreground hover:text-foreground",
					)}
				>
					{Icon ? <Icon className="size-4" /> : null}
					{label}
				</button>
			))}
		</div>
	);
}
