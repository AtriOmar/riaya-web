"use client";

import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "@/components/ui/combobox";
import type { City } from "@/services/types";

type Props = {
	cities: City[];
	value?: string;
	onChange: (value: string) => void;
};

type CityOption = {
	value: string;
	label: string;
	keywords: string[];
};

function getCityLabel(c: City) {
	return c.enName ?? c.frName ?? c.arName ?? "—";
}

function cityKeywords(c: City): string[] {
	const parts = [
		c.enName,
		c.frName,
		c.arName,
		c.postalCode != null ? String(c.postalCode) : undefined,
		c.slug,
	];
	return parts.filter((p): p is string => Boolean(p));
}

function filterOption(item: CityOption, query: string): boolean {
	const q = query.trim().toLowerCase();
	if (!q) return true;
	const haystack = [item.label, ...item.keywords].join(" ").toLowerCase();
	return haystack.includes(q);
}

export default function CitySelect({ cities, value, onChange }: Props) {
	const items: CityOption[] = cities.map((c) => ({
		value: String(c.id),
		label: getCityLabel(c),
		keywords: cityKeywords(c),
	}));
	const selected = items.find((o) => o.value === value) ?? null;

	return (
		<Combobox
			items={items}
			value={selected}
			onValueChange={(v) => onChange(v?.value ?? "")}
			filter={(item, query) => filterOption(item as CityOption, query)}
			isItemEqualToValue={(a, b) => a.value === b.value}
		>
			<ComboboxInput
				placeholder="Select or search a city..."
				className="mt-1 w-full min-w-80 sm:w-fit"
			/>
			<ComboboxContent>
				<ComboboxList>
					{(item: CityOption) => (
						<ComboboxItem key={item.value} value={item}>
							{item.label}
						</ComboboxItem>
					)}
				</ComboboxList>
				<ComboboxEmpty>No city matches your search.</ComboboxEmpty>
			</ComboboxContent>
		</Combobox>
	);
}
