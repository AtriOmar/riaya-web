"use client";

import { Command as CommandPrimitive } from "cmdk";
import { MapPin, Search } from "lucide-react";
import { useEffect, useState } from "react";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";

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
};

export default function AddressSearchBar({
	onLocationSelect,
	biasLocation,
	className,
}: Props) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const debouncedQuery = useDebounce(query, 300);
	const [results, setResults] = useState<any[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		const controller = new AbortController();

		async function search() {
			if (!debouncedQuery) {
				setResults([]);
				return;
			}

			const apiKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;
			if (!apiKey) return;

			setLoading(true);
			try {
				let url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(debouncedQuery)}&apiKey=${apiKey}&limit=5&filter=countrycode:tn`;
				if (biasLocation) {
					url += `&bias=proximity:${biasLocation.lng},${biasLocation.lat}`;
				}

				const res = await fetch(url, { signal: controller.signal });
				const data = await res.json();
				setResults(data.features || []);
			} catch (err: any) {
				if (err.name === "AbortError") return;
				console.error("Geoapify search error:", err);
			} finally {
				setLoading(false);
			}
		}

		search();

		return () => {
			controller.abort();
		};
	}, [debouncedQuery, biasLocation]);

	return (
		<div className={cn("relative", className)}>
			<Command
				shouldFilter={false}
				className="bg-transparent! p-0! overflow-visible"
			>
				<div className="relative">
					<Search className="z-10 top-1/2 left-3 absolute opacity-50 w-4 h-4 -translate-y-1/2 shrink-0 pointer-events-none" />
					<CommandPrimitive.Input
						placeholder="Search for your address..."
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
							{loading && (
								<div className="p-4 text-muted-foreground text-sm text-center">
									Searching...
								</div>
							)}
							{!loading && results.length === 0 && (
								<CommandEmpty>No address found.</CommandEmpty>
							)}
							<CommandGroup>
								{results.map((feature) => {
									const props = feature.properties;
									const key = props.place_id || `${props.lat}-${props.lon}`;
									return (
										<CommandItem
											key={key}
											value={key}
											onSelect={() => {
												onLocationSelect({
													lat: props.lat,
													lon: props.lon,
													address: props.formatted,
													city: props.city,
												});
												setOpen(false);
												setQuery(props.formatted);
											}}
										>
											<MapPin className="opacity-50 mr-2 w-4 h-4 shrink-0" />
											<span className="truncate">{props.formatted}</span>
										</CommandItem>
									);
								})}
							</CommandGroup>
						</CommandList>
					</div>
				)}
			</Command>
		</div>
	);
}
