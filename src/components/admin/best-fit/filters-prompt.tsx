import { CalendarSearch, MapPin, Stethoscope } from "lucide-react";
import type { BestFitFilters } from "@/components/admin/best-fit/filter-bar";

type Props = {
	filters: BestFitFilters;
	viewMode: "calendar" | "map";
};

function promptCopy(filters: BestFitFilters, viewMode: "calendar" | "map") {
	const hasSpeciality = filters.specialitySlug != null;
	const hasLocation = filters.lat != null && filters.long != null;

	if (!hasSpeciality && !hasLocation) {
		return {
			icon: viewMode === "map" ? MapPin : CalendarSearch,
			title: "Choose a speciality and location",
			description:
				viewMode === "map"
					? "Pick both filters above to see nearby doctors on the map."
					: "Pick both filters above to load available doctors this week.",
		};
	}
	if (!hasSpeciality) {
		return {
			icon: Stethoscope,
			title: "Choose a speciality",
			description: "Select a speciality above to find matching doctors.",
		};
	}
	return {
		icon: MapPin,
		title: "Choose a patient location",
		description: "Select a city or drop a pin to find nearby doctors.",
	};
}

export default function BestFitFiltersPrompt({ filters, viewMode }: Props) {
	const { icon: Icon, title, description } = promptCopy(filters, viewMode);

	return (
		<div className="mt-4 flex flex-col items-center justify-center rounded-xl border bg-card px-6 py-16 text-center shadow-sm">
			<div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
				<Icon className="size-6 text-muted-foreground" />
			</div>
			<p className="font-semibold text-foreground">{title}</p>
			<p className="mt-1 max-w-sm text-sm text-muted-foreground">
				{description}
			</p>
		</div>
	);
}
