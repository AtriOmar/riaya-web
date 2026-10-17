"use client";

import { Command as CommandPrimitive } from "cmdk";
import { MapPin, Search } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { useDebounce } from "@/hooks/use-debounce";
import { getErrorMessage } from "@/lib/error-handling";
import { cn } from "@/lib/utils";
import type { GetApiPlacesAutocomplete200Item } from "@/services/generated/api.schemas";
import {
	getApiPlacesDetails,
	useGetApiPlacesAutocomplete,
} from "@/services/generated/places/places";

export type GeoLocation = {
	lat: number;
	lon: number;
	address: string;
	city?: string;
};

type Props = {
	onLocationSelect: (location: GeoLocation) => void;
	biasLocation?: { lat: number; lng: number };
	className?: string;
	placeholder?: string;
};

export default function AddressSearchBar({
	onLocationSelect,
	biasLocation,
	className,
	placeholder = "Search for your address...",
}: Props) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [resolving, setResolving] = useState(false);
	const debouncedQuery = useDebounce(query, 300);
	// One token per typing session so the provider can bill suggestions + the
	// final pick as a single lookup. Renewed after each selection.
	const sessionToken = useRef(crypto.randomUUID());

	const {
		data: results = [],
		isLoading: loading,
		error,
	} = useGetApiPlacesAutocomplete(
		{
			text: debouncedQuery,
			lat: biasLocation?.lat,
			lng: biasLocation?.lng,
			sessionToken: sessionToken.current,
		},
		{ swr: { enabled: debouncedQuery.length > 0, keepPreviousData: true } },
	);

	async function selectPlace(place: GetApiPlacesAutocomplete200Item) {
		setOpen(false);
		setQuery(place.label);
		try {
			let { lat, lng, city } = place;
			let address = place.label;
			// Some providers (Google) return suggestions without coordinates.
			if (lat == null || lng == null) {
				setResolving(true);
				const full = await getApiPlacesDetails({
					id: place.id,
					sessionToken: sessionToken.current,
				});
				lat = full.lat;
				lng = full.lng;
				city = full.city;
				address = full.label || address;
			}
			if (lat == null || lng == null) throw new Error("No coordinates");
			onLocationSelect({ lat, lon: lng, address, city: city ?? undefined });
		} catch (err) {
			toast.error(getErrorMessage(err));
		} finally {
			setResolving(false);
			sessionToken.current = crypto.randomUUID();
		}
	}

	return (
		<div className={cn("relative", className)}>
			<Command
				shouldFilter={false}
				className="bg-transparent! p-0! overflow-visible"
			>
				<div className="relative">
					<Search className="z-10 top-1/2 left-3 absolute opacity-50 w-4 h-4 -translate-y-1/2 shrink-0 pointer-events-none" />
					<CommandPrimitive.Input
						placeholder={placeholder}
						value={query}
						onValueChange={setQuery}
						onFocus={() => setOpen(true)}
						onBlur={() => setTimeout(() => setOpen(false), 200)}
						className="flex bg-background/80 file:bg-transparent disabled:opacity-50 shadow-sm backdrop-blur-sm py-2 pr-3 pl-9 border border-input file:border-0 rounded-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ring-offset-background focus-visible:ring-offset-0 w-full h-10 file:font-medium placeholder:text-muted-foreground text-sm file:text-sm disabled:cursor-not-allowed"
					/>
				</div>
				{open && query.length > 0 && (
					<div className="top-full z-50 absolute bg-popover shadow-md mt-1 border rounded-md w-full overflow-hidden text-popover-foreground">
						<CommandList>
							{(loading || resolving) && (
								<div className="p-4 text-muted-foreground text-sm text-center">
									{resolving ? "Locating..." : "Searching..."}
								</div>
							)}
							{!loading && !resolving && !!error && (
								<div className="p-4 text-muted-foreground text-sm text-center">
									{getErrorMessage(error)}
								</div>
							)}
							{!loading && !resolving && !error && results.length === 0 && (
								<CommandEmpty>No address found.</CommandEmpty>
							)}
							<CommandGroup>
								{results.map((place) => (
									<CommandItem
										key={place.id}
										value={place.id}
										onSelect={() => selectPlace(place)}
									>
										<MapPin className="opacity-50 mr-2 w-4 h-4 shrink-0" />
										<span className="truncate">{place.label}</span>
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</div>
				)}
			</Command>
		</div>
	);
}
