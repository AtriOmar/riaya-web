"use client";

import { Copy, Moon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TimePicker } from "@/components/ui/time-picker";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePractice } from "@/hooks/use-practice";
import { cn } from "@/lib/utils";
import type { PutApiUsersBodyAvailability } from "@/services/generated/api.schemas";
import {
	useGetApiUsersMe,
	usePutApiUsers,
} from "@/services/generated/users/users";

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

const DEFAULT_HOURS = { start: toMinutes(9, 0), end: toMinutes(17, 0) };

export default function AvailabilityForm() {
	const { me, isLoading } = usePractice();
	const saved = me?.practice?.availability;
	if (isLoading || !me) return null;
	// Remount when the saved hours load, so the form starts from them
	return <AvailabilityFormInner initial={saved ?? {}} />;
}

function AvailabilityFormInner({
	initial,
}: {
	initial: PutApiUsersBodyAvailability;
}) {
	const [availability, setAvailability] =
		useState<PutApiUsersBodyAvailability>(initial);
	const { trigger: updateAvailability, isMutating: saving } = usePutApiUsers();
	const { mutate: mutateMe } = useGetApiUsersMe();

	function handleToggle(day: number) {
		setAvailability((prev) => {
			const slots =
				prev[day.toString() as keyof PutApiUsersBodyAvailability] ?? [];
			return {
				...prev,
				[day]: slots.length ? [] : [{ ...DEFAULT_HOURS }],
			};
		});
	}

	/** Gives every other day the same hours as `day` */
	function handleCopy(day: number) {
		const source =
			availability[day.toString() as keyof PutApiUsersBodyAvailability] ?? [];
		setAvailability(
			Object.fromEntries(
				DAYS.map((_, i) => [
					i,
					i === day ? source : source.map((s) => ({ ...s })),
				]),
			),
		);
		toast.success(`${DAYS[day]}'s hours copied to the other days`);
	}

	function handleTimeChange(
		day: number,
		field: "start" | "end",
		value: string,
	) {
		const minutes = parseTime(value);
		setAvailability((prev) => {
			const slots =
				prev[day.toString() as keyof PutApiUsersBodyAvailability] ?? [];
			if (!slots[0]) return prev;
			const updated = [{ ...slots[0], [field]: minutes }];
			return { ...prev, [day]: updated };
		});
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		try {
			await updateAvailability({ availability });
			await mutateMe();
			toast.success("Availability updated successfully");
		} catch {
			toast.error("Failed to update availability");
		}
	}

	return (
		<form className="space-y-3 mt-4 max-w-3xl" onSubmit={handleSubmit}>
			{DAYS.map((day, index) => {
				const slots =
					availability[index.toString() as keyof PutApiUsersBodyAvailability] ??
					[];
				const active = slots.length > 0;

				return (
					<div
						key={day}
						className="items-center gap-4 grid grid-cols-[60px_100px_1fr_1fr_36px]"
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
									<TimePicker
										id={`day-${index}-start`}
										value={fromMinutes(slots[0].start)}
										onChange={(v) => handleTimeChange(index, "start", v)}
										className="w-[120px] ml-auto"
									/>
								</label>
								<label
									htmlFor={`day-${index}-end`}
									className="flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-muted transition cursor-pointer"
								>
									<span className="text-muted-foreground text-sm">To</span>
									<TimePicker
										id={`day-${index}-end`}
										value={fromMinutes(slots[0].end)}
										onChange={(v) => handleTimeChange(index, "end", v)}
										className="w-[120px] ml-auto"
									/>
								</label>
							</>
						) : (
							<div className="flex justify-center items-center gap-2 col-span-2 px-3 py-2 border rounded-md text-muted-foreground">
								<Moon className="w-5 h-5" />
								<span>Closed</span>
							</div>
						)}

						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									aria-label={`Copy ${day}'s hours to the other days`}
									disabled={!active}
									onClick={() => handleCopy(index)}
								>
									<Copy className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Copy to the other days</TooltipContent>
						</Tooltip>
					</div>
				);
			})}

			<div className="flex justify-end gap-2 mt-4">
				<Button
					type="button"
					variant="outline"
					onClick={() => setAvailability(initial)}
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
