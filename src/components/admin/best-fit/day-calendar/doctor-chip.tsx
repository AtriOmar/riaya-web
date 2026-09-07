import type { BestFitRangeDoctor } from "@/hooks/use-best-fit-range";
import { cn } from "@/lib/utils";
import { shortName } from "../shared/helpers";

type Props = {
	doctor: BestFitRangeDoctor;
	colorClass: string;
	date: Date;
	onSelectDoctor: (id: number, d: Date) => void;
};

export default function DoctorChip({
	doctor,
	colorClass,
	date,
	onSelectDoctor,
}: Props) {
	const name = shortName(doctor);
	const address = doctor.address?.trim() || null;
	const title = [name, address, `${doctor.distance.toFixed(1)} km`]
		.filter(Boolean)
		.join(" · ");

	return (
		<button
			type="button"
			title={title}
			onClick={() => onSelectDoctor(doctor.id, date)}
			className={cn(
				"flex flex-col items-start gap-0.5 rounded-md border px-2 py-1.5 min-w-0",
				"text-left transition-colors duration-100",
				colorClass,
			)}
		>
			<span className="truncate w-full text-xs font-medium leading-tight">
				{name}
			</span>
			<span className="truncate w-full text-[10px] leading-tight opacity-70">
				{doctor.distance.toFixed(1)} km
				{address ? ` · ${address}` : ""}
			</span>
		</button>
	);
}
