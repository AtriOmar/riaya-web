"use client";

import { Moon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { updateAvailability } from "@/services";
import type { Availability } from "@/services/types";

const DAYS = [
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
	"Sunday",
];

function toMinutes(h: number, m: number) {
	return h * 60 + m;
}
function fromMinutes(min: number) {
	const h = Math.floor(min / 60);
	const m = min % 60;
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function parseTime(val: string): number {
	const [h, m] = val.split(":").map(Number);
	return h * 60 + m;
}

const defaultAvailability: Availability = {
	0: [{ start: toMinutes(9, 0), end: toMinutes(17, 0) }],
	1: [{ start: toMinutes(9, 0), end: toMinutes(17, 0) }],
	2: [{ start: toMinutes(9, 0), end: toMinutes(17, 0) }],
	3: [{ start: toMinutes(9, 0), end: toMinutes(17, 0) }],
	4: [{ start: toMinutes(9, 0), end: toMinutes(17, 0) }],
	5: [],
	6: [],
};

export default function AvailabilityForm() {
	const [availability, setAvailability] =
		useState<Availability>(defaultAvailability);
	const [saving, setSaving] = useState(false);

	function handleToggle(day: number) {
		setAvailability((prev) => {
			const slots = prev[day as keyof Availability] ?? [];
			return {
				...prev,
				[day]: slots.length
					? []
					: [{ start: toMinutes(9, 0), end: toMinutes(17, 0) }],
			};
		});
	}

	function handleTimeChange(
		day: number,
		field: "start" | "end",
		value: string,
	) {
		const minutes = parseTime(value);
		setAvailability((prev) => {
			const slots = prev[day as keyof Availability] ?? [];
			if (!slots[0]) return prev;
			const updated = [{ ...slots[0], [field]: minutes }];
			return { ...prev, [day]: updated };
		});
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		try {
			await updateAvailability(availability);
			toast.success("Availability updated successfully");
		} catch {
			toast.error("Failed to update availability");
		} finally {
			setSaving(false);
		}
	}

	return (
		<form className="space-y-3 mt-4" onSubmit={handleSubmit}>
			{DAYS.map((day, index) => {
				const slots = availability[index as keyof Availability] ?? [];
				const active = slots.length > 0;

				return (
					<div
						key={day}
						className="items-center gap-4 grid grid-cols-[60px_100px_1fr_1fr]"
					>
						<button
							type="button"
							onClick={() => handleToggle(index)}
							className={cn(
								"relative w-[52px] h-[28px] rounded-full transition-colors shrink-0",
								active ? "bg-primary" : "bg-muted-foreground/30",
							)}
						>
							<span
								className={cn(
									"top-1/2 absolute w-[22px] h-[22px] rounded-full bg-white shadow transition-all -translate-y-1/2",
									active ? "left-[27px]" : "left-[3px]",
								)}
							/>
						</button>

						<p className="font-medium text-sm">{day}</p>

						{active ? (
							<>
								<label
									htmlFor={`day-${index}-start`}
									className="flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-muted transition cursor-pointer"
								>
									<span className="text-muted-foreground text-sm">From</span>
									<Input
										id={`day-${index}-start`}
										type="time"
										value={fromMinutes(slots[0].start)}
										onChange={(e) =>
											handleTimeChange(index, "start", e.target.value)
										}
										className="w-[120px] h-auto ml-auto p-0 border-0 text-right"
									/>
								</label>
								<label
									htmlFor={`day-${index}-end`}
									className="flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-muted transition cursor-pointer"
								>
									<span className="text-muted-foreground text-sm">To</span>
									<Input
										id={`day-${index}-end`}
										type="time"
										value={fromMinutes(slots[0].end)}
										onChange={(e) =>
											handleTimeChange(index, "end", e.target.value)
										}
										className="w-[120px] h-auto ml-auto p-0 border-0 text-right"
									/>
								</label>
							</>
						) : (
							<div className="flex justify-center items-center gap-2 col-span-2 px-3 py-2 border rounded-md text-muted-foreground">
								<Moon className="w-5 h-5" />
								<span>Closed</span>
							</div>
						)}
					</div>
				);
			})}

			<div className="flex justify-end gap-2 mt-4">
				<Button
					type="button"
					variant="outline"
					onClick={() => setAvailability(defaultAvailability)}
				>
					Reset
				</Button>
				<Button type="submit" disabled={saving}>
					{saving ? "Saving..." : "Save"}
				</Button>
			</div>
		</form>
	);
}
