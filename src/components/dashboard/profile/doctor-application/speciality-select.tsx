"use client";

import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "@/components/ui/combobox";
import type { GetApiSpecialities200Item } from "@/services/generated/api.schemas";

type Props = {
	specialities: GetApiSpecialities200Item[];
	value?: string;
	onChange: (value: string) => void;
};

type SpecialityOption = {
	value: string;
	label: string;
	keywords: string[];
};

function getSpecialityLabel(c: GetApiSpecialities200Item) {
	return c.enName ?? c.frName ?? c.arName ?? "—";
}

function specialityKeywords(c: GetApiSpecialities200Item): string[] {
	const parts = [c.enName, c.frName, c.arName, c.slug];
	return parts.filter((p): p is string => Boolean(p));
}

function filterOption(item: SpecialityOption, query: string): boolean {
	const q = query.trim().toLowerCase();
	if (!q) return true;
	const haystack = [item.label, ...item.keywords].join(" ").toLowerCase();
	return haystack.includes(q);
}

export default function SpecialitySelect({
	specialities,
	value,
	onChange,
}: Props) {
	const items: SpecialityOption[] = specialities.map((s) => ({
		value: String(s.id),
		label: getSpecialityLabel(s),
		keywords: specialityKeywords(s),
	}));
	const selected = items.find((o) => o.value === value) ?? null;

	return (
		<Combobox
			items={items}
			value={selected}
			onValueChange={(v) => onChange(v?.value ?? "")}
			filter={(item, query) => filterOption(item as SpecialityOption, query)}
			isItemEqualToValue={(a, b) => a.value === b.value}
		>
			<ComboboxInput
				placeholder="Select or search a speciality..."
				className="mt-1 w-full min-w-80 sm:w-fit"
			/>
			<ComboboxContent>
				<ComboboxList>
					{(item: SpecialityOption) => (
						<ComboboxItem key={item.value} value={item}>
							{item.label}
						</ComboboxItem>
					)}
				</ComboboxList>
				<ComboboxEmpty>No speciality matches your search.</ComboboxEmpty>
			</ComboboxContent>
		</Combobox>
	);
}
