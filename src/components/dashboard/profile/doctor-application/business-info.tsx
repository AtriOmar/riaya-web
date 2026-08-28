import { Layers, Maximize2, Minimize2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { City } from "@/services/types";
import AddressSearchBar, { type GeoLocation } from "./address-search-bar";
import CabinetLocationMap from "./cabinet-location-map";
import CitySelect from "./city-select";
import type { FormValues } from "./schema";

const DEFAULT_CENTER = { lat: 33.8869, lng: 9.5375 }; // Tunisia center

type Props = {
	cities: City[];
};

export default function BusinessInfo({ cities }: Props) {
	const {
		register,
		formState: { errors },
		setValue,
		watch,
		clearErrors,
	} = useFormContext<FormValues>();

	const cabinetCityId = watch("cabinetCityId");
	const cabinetLatitude = watch("cabinetLatitude");
	const cabinetLongitude = watch("cabinetLongitude");

	const [isFullscreen, setIsFullscreen] = useState(false);
	const [mapStyle, setMapStyle] = useState<"street" | "satellite">("street");
	const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(
		cabinetLatitude && cabinetLongitude
			? { lat: cabinetLatitude, lng: cabinetLongitude }
			: DEFAULT_CENTER,
	);
	const mapContainerRef = useRef<HTMLDivElement>(null);

	const handleLocationSelect = useCallback(
		(location: GeoLocation) => {
			setMapCenter({ lat: location.lat, lng: location.lon });
			setValue("cabinetLatitude", location.lat, { shouldValidate: true });
			setValue("cabinetLongitude", location.lon, { shouldValidate: true });
		},
		[setValue],
	);

	useEffect(() => {
		function handleFullscreenChange() {
			setIsFullscreen(!!document.fullscreenElement);
		}
		document.addEventListener("fullscreenchange", handleFullscreenChange);
		return () => {
			document.removeEventListener("fullscreenchange", handleFullscreenChange);
		};
	}, []);

	return (
		<div>
			<div className="bg-border my-6 h-px" />
			<h3 className="font-semibold text-xl">Cabinet Information</h3>

			<div className="space-y-2 mt-4">
				<Label htmlFor="cabinetName">
					Cabinet Name <span className="text-destructive">*</span>
				</Label>
				<Input
					id="cabinetName"
					placeholder="Ibn Al Nafis"
					{...register("cabinetName")}
				/>
				{errors.cabinetName && (
					<p className="mt-1 text-destructive text-sm">
						{errors.cabinetName.message}
					</p>
				)}
			</div>

			<div className="space-y-2 mt-4">
				<Label htmlFor="tin">
					TIN (Tax Identification Number){" "}
					<span className="text-destructive">*</span>
				</Label>
				<Input id="tin" placeholder="1234567X" {...register("tin")} />
				{errors.tin && (
					<p className="mt-1 text-destructive text-sm">{errors.tin.message}</p>
				)}
			</div>

			<div className="space-y-2 mt-4">
				<Label>
					Cabinet city <span className="text-destructive">*</span>
				</Label>
				<CitySelect
					cities={cities}
					value={cabinetCityId}
					onChange={(v) =>
						setValue("cabinetCityId", v, { shouldValidate: true })
					}
				/>
				{errors.cabinetCityId && (
					<p className="mt-1 text-destructive text-sm">
						{errors.cabinetCityId.message}
					</p>
				)}
			</div>

			<div className="space-y-2 mt-4">
				<Label>
					Exact Location <span className="text-destructive">*</span>
				</Label>
				<div
					ref={mapContainerRef}
					className={cn(
						"z-10 relative bg-background mt-2 transition-all duration-300",
						isFullscreen ? "w-full h-screen" : "",
					)}
				>
					<div className="relative w-full">
						<div className="top-3 left-1/2 z-[2000] absolute w-11/12 max-w-sm -translate-x-1/2">
							<AddressSearchBar
								onLocationSelect={handleLocationSelect}
								biasLocation={mapCenter}
								className="w-full"
							/>
						</div>
						<Button
							type="button"
							variant="secondary"
							size="icon"
							className="right-14 bottom-3 z-[2000] absolute shadow-md rounded-lg"
							onClick={() =>
								setMapStyle(mapStyle === "street" ? "satellite" : "street")
							}
							title="Toggle Map Style"
						>
							<Layers className="size-4" />
						</Button>
						<Button
							type="button"
							variant="secondary"
							size="icon"
							className="right-3 bottom-3 z-[2000] absolute shadow-md rounded-lg"
							onClick={async () => {
								if (!document.fullscreenElement) {
									await mapContainerRef.current?.requestFullscreen();
								} else {
									await document.exitFullscreen();
								}
							}}
							title="Toggle Fullscreen"
						>
							{isFullscreen ? (
								<Minimize2 className="size-4" />
							) : (
								<Maximize2 className="size-4" />
							)}
						</Button>
						<CabinetLocationMap
							className={isFullscreen ? "h-[100dvh] rounded-none" : "h-[500px]"}
							center={mapCenter}
							mapStyle={mapStyle}
							marker={
								cabinetLatitude && cabinetLongitude
									? { lat: cabinetLatitude, lng: cabinetLongitude }
									: null
							}
							onMarkerClick={() => {
								// @ts-expect-error - intentionally setting to undefined to clear
								setValue("cabinetLatitude", undefined);
								// @ts-expect-error - intentionally setting to undefined to clear
								setValue("cabinetLongitude", undefined);
								clearErrors(["cabinetLatitude", "cabinetLongitude"]);
							}}
							onMapClick={(lat, lng) => {
								setValue("cabinetLatitude", lat, { shouldValidate: true });
								setValue("cabinetLongitude", lng, { shouldValidate: true });
							}}
						/>
					</div>
					{(errors.cabinetLatitude || errors.cabinetLongitude) && (
						<p className="mt-1 text-destructive text-sm">
							{errors.cabinetLatitude?.message ||
								errors.cabinetLongitude?.message}
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
