"use client";

import { Clock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTE_STEP = 5;

const pad = (n: number) => String(n).padStart(2, "0");

type TimePickerProps = {
	id?: string;
	/** "HH:mm" */
	value: string;
	onChange: (value: string) => void;
	className?: string;
};

function Column({
	items,
	selected,
	onSelect,
	label,
}: {
	items: number[];
	selected: number;
	onSelect: (n: number) => void;
	label: string;
}) {
	const selectedRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		selectedRef.current?.scrollIntoView({ block: "center" });
	}, []);

	return (
		<div
			role="listbox"
			aria-label={label}
			className="flex flex-col gap-0.5 w-14 max-h-56 overflow-y-auto pr-0.5 scroll-smooth"
		>
			{items.map((n) => (
				<button
					key={n}
					ref={n === selected ? selectedRef : undefined}
					type="button"
					role="option"
					aria-selected={n === selected}
					onClick={() => onSelect(n)}
					className={cn(
						"py-1.5 rounded-md text-sm tabular-nums transition-colors",
						n === selected
							? "bg-primary text-primary-foreground font-medium"
							: "hover:bg-muted",
					)}
				>
					{pad(n)}
				</button>
			))}
		</div>
	);
}

export function TimePicker({
	id,
	value,
	onChange,
	className,
}: TimePickerProps) {
	const [open, setOpen] = useState(false);
	const [h, m] = value.split(":").map(Number);

	// Keep a saved minute that isn't on the step grid selectable
	const minutes = Array.from(
		{ length: 60 / MINUTE_STEP },
		(_, i) => i * MINUTE_STEP,
	);
	if (!minutes.includes(m)) minutes.push(m);
	minutes.sort((a, b) => a - b);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					id={id}
					type="button"
					className={cn(
						"flex items-center justify-end gap-2 tabular-nums text-sm outline-none",
						className,
					)}
				>
					{value}
					<Clock className="size-4 text-muted-foreground" />
				</button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-auto flex-row gap-1 p-1.5">
				<Column
					label="Hour"
					items={HOURS}
					selected={h}
					onSelect={(n) => onChange(`${pad(n)}:${pad(m)}`)}
				/>
				<div className="w-px bg-border" />
				<Column
					label="Minute"
					items={minutes}
					selected={m}
					onSelect={(n) => {
						onChange(`${pad(h)}:${pad(n)}`);
						setOpen(false);
					}}
				/>
			</PopoverContent>
		</Popover>
	);
}
