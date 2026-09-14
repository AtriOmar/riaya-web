"use client";

import type { CountryCode } from "libphonenumber-js";
import { getCountryCallingCode } from "libphonenumber-js";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import type { ComponentType } from "react";
import { useMemo, useState } from "react";
import flags from "react-phone-number-input/flags";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { InputGroupButton } from "@/components/ui/input-group";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { PHONE_COUNTRY_OPTIONS, type PhoneCountryOption } from "@/lib/phone";
import { cn } from "@/lib/utils";

type FlagComponent = ComponentType<{ title?: string }>;

function CountryFlag({
	country,
	className,
}: {
	country: CountryCode;
	className?: string;
}) {
	const Flag = (flags as Record<string, FlagComponent | undefined>)[country];
	if (!Flag) return null;
	return (
		<span
			className={cn(
				"relative inline-flex h-3.5 w-5 shrink-0 overflow-hidden rounded-[1px] ring-1 ring-border/60",
				className,
			)}
		>
			<span className="absolute inset-0 [&_img]:size-full [&_img]:object-cover [&_svg]:block [&_svg]:size-full">
				<Flag title={country} />
			</span>
		</span>
	);
}

type Props = {
	value: CountryCode;
	onChange: (country: CountryCode) => void;
	disabled?: boolean;
	id?: string;
};

export function PhoneCountryCombobox({ value, onChange, disabled, id }: Props) {
	const [open, setOpen] = useState(false);
	const items = PHONE_COUNTRY_OPTIONS;
	const selected =
		items.find((item) => item.code === value) ?? items[0] ?? null;

	const searchValues = useMemo(
		() =>
			items.map((item) => ({
				item,
				search: [
					item.label,
					item.code,
					`+${getCountryCallingCode(item.code)}`,
				].join(" "),
			})),
		[items],
	);

	if (!selected) return null;

	const callingCode = getCountryCallingCode(selected.code);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<InputGroupButton
					id={id}
					type="button"
					disabled={disabled}
					className="h-7 gap-1.5 px-1.5 font-normal text-foreground"
					aria-label="Country calling code"
					role="combobox"
					aria-expanded={open}
				>
					<CountryFlag country={selected.code} />
					<span className="text-sm tabular-nums">+{callingCode}</span>
					<ChevronsUpDownIcon className="size-3.5 text-muted-foreground" />
				</InputGroupButton>
			</PopoverTrigger>
			<PopoverContent className="w-[min(100vw-2rem,280px)] p-0" align="start">
				<Command>
					<CommandInput placeholder="Search country…" />
					<CommandList>
						<CommandEmpty>No country found.</CommandEmpty>
						<CommandGroup>
							{searchValues.map(({ item, search }) => (
								<CountryCommandItem
									key={item.code}
									item={item}
									search={search}
									selected={selected.code === item.code}
									onSelect={() => {
										onChange(item.code);
										setOpen(false);
									}}
								/>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

function CountryCommandItem({
	item,
	search,
	selected,
	onSelect,
}: {
	item: PhoneCountryOption;
	search: string;
	selected: boolean;
	onSelect: () => void;
}) {
	const callingCode = getCountryCallingCode(item.code);

	return (
		<CommandItem value={search} onSelect={onSelect}>
			<CheckIcon
				className={cn("size-4", selected ? "opacity-100" : "opacity-0")}
			/>
			<CountryFlag country={item.code} />
			<span className="flex-1 truncate">{item.label}</span>
			<span className="text-muted-foreground text-xs tabular-nums">
				+{callingCode}
			</span>
		</CommandItem>
	);
}
