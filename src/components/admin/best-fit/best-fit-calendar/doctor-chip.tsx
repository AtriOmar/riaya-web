import type { BestFitRangeDoctor } from "@/hooks/use-best-fit-range";
import { cn } from "@/lib/utils";
import { shortName } from "../shared/helpers";

type Props = {
	doctor: BestFitRangeDoctor;
	colorClass: string;
	day: Date;
	onSelectDoctor: (id: number, d: Date) => void;
};

export default function DoctorChip({
	doctor,
	colorClass,
	day,
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
			onClick={(e) => {
				e.stopPropagation();
				onSelectDoctor(doctor.id, day);
			}}
			className={cn(
				"flex flex-col items-start gap-0.5 rounded border px-1.5 py-0.5 w-full min-w-0",
				"text-left transition-colors duration-100",
				colorClass,
			)}
		>
			<span className="truncate w-full text-[11px] font-medium leading-none">
				{name}
			</span>
			{address ? (
				<span className="truncate w-full text-[9px] font-normal leading-none opacity-70">
					{address}
				</span>
			) : null}
		</button>
	);
}
