"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Layers, Maximize2, Minimize2, Upload } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth } from "@/components/contexts/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadToR2 } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { createDoctorApplication } from "@/services";
import type { City, Speciality } from "@/services/types";
import AddressSearchBar, { type GeoLocation } from "./address-search-bar";
import CitySelect from "./city-select";
import SpecialitySelect from "./speciality-select";

const CabinetLocationMap = dynamic(() => import("./cabinet-location-map"), {
	ssr: false,
	loading: () => (
		<div className="flex justify-center items-center bg-muted rounded-lg w-full h-[300px] animate-pulse">
			Loading map...
		</div>
	),
});

const schema = z.object({
	firstName: z
		.string()
		.min(2, "First name must be at least 2 characters")
		.regex(/^[A-Za-z ]+$/, "Letters only"),
	lastName: z
		.string()
		.min(2, "Last name must be at least 2 characters")
		.regex(/^[A-Za-z ]+$/, "Letters only"),
	cabinetName: z.string().min(2, "Cabinet name is required"),
	cabinetCityId: z.string().min(1, "City is required"),
	cabinetLatitude: z.custom<number>(
		(val) => typeof val === "number",
		"Exact location on map is required",
	),
	cabinetLongitude: z.custom<number>(
		(val) => typeof val === "number",
		"Exact location on map is required",
	),
	specialityId: z.string().min(1, "Speciality is required"),
	tin: z
		.string()
		.regex(/^\d{7}[A-Z]$/, "Format: 0000000X (7 digits + uppercase letter)"),
});

type FormValues = z.infer<typeof schema>;

type Props = {
	specialities: Speciality[];
	cities: City[];
	onApplicationSubmitted: () => void;
};

function CinPlaceholder({ src }: { src: string }) {
	return (
		<>
			<Image
				src={src}
				alt=""
				fill
				className="opacity-35 object-cover"
				sizes="300px"
			/>
			<div className="z-10 absolute inset-0 flex justify-center items-center pointer-events-none">
				<span className="flex justify-center items-center bg-background/90 shadow-md backdrop-blur-[2px] ring-border rounded-md ring-1 size-12 text-primary">
					<Upload className="size-5" aria-hidden />
				</span>
			</div>
		</>
	);
}

export default function DoctorApplicationForm({
	specialities,
	cities,
	onApplicationSubmitted,
}: Props) {
	ReactDOM.preconnect("https://maps.geoapify.com");
	ReactDOM.preconnect("https://api.geoapify.com");

	const { user } = useAuth();

	const [cinRecto, setCinRecto] = useState<File | null>(null);
	const [cinVerso, setCinVerso] = useState<File | null>(null);
	const [cinRectoError, setCinRectoError] = useState<string | null>(null);
	const [cinVersoError, setCinVersoError] = useState<string | null>(null);
	const [sending, setSending] = useState(false);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [mapStyle, setMapStyle] = useState<"street" | "satellite">("street");
	const [mapCenter, setMapCenter] = useState({ lat: 36.8065, lng: 10.1815 });
	const [_cinModal, setCinModal] = useState<{
		side: "recto" | "verso";
		imageUrl: string;
	} | null>(null);

	const cinRectoRef = useRef<HTMLInputElement>(null);
	const cinVersoRef = useRef<HTMLInputElement>(null);
	const mapContainerRef = useRef<HTMLDivElement>(null);

	const {
		register,
		handleSubmit,
		formState: { errors },
		setValue,
		watch,
		clearErrors,
	} = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: {
			firstName: "",
			lastName: "",
			cabinetName: "",
			cabinetCityId: "",
			specialityId: "",
			tin: "",
			cabinetLatitude: undefined as unknown as number,
			cabinetLongitude: undefined as unknown as number,
		},
	});

	useEffect(() => {
		function handleFullscreenChange() {
			setIsFullscreen(!!document.fullscreenElement);
		}
		document.addEventListener("fullscreenchange", handleFullscreenChange);
		return () =>
			document.removeEventListener("fullscreenchange", handleFullscreenChange);
	}, []);

	const specialityId = watch("specialityId");
	const cabinetCityId = watch("cabinetCityId");
	const cabinetLatitude = watch("cabinetLatitude");
	const cabinetLongitude = watch("cabinetLongitude");

	function handleLocationSelect(loc: GeoLocation) {
		setValue("cabinetLatitude", loc.lat, { shouldValidate: true });
		setValue("cabinetLongitude", loc.lon, { shouldValidate: true });
		setMapCenter({ lat: loc.lat, lng: loc.lon });

		if (loc.city) {
			const lowerCity = loc.city.toLowerCase();
			const found = cities.find(
				(c) =>
					c.enName?.toLowerCase().includes(lowerCity) ||
					c.frName?.toLowerCase().includes(lowerCity) ||
					c.arName?.toLowerCase().includes(lowerCity) ||
					lowerCity.includes(c.enName?.toLowerCase() || "---"),
			);
			if (found) {
				setValue("cabinetCityId", found.id.toString(), {
					shouldValidate: true,
				});
			}
		}
	}

	function handleCinFile(side: "recto" | "verso", file: File) {
		const url = URL.createObjectURL(file);
		setCinModal({ side, imageUrl: url });
		if (side === "recto") {
			setCinRecto(file);
			setCinRectoError(null);
		} else {
			setCinVerso(file);
			setCinVersoError(null);
		}
	}

	async function onSubmit(values: FormValues) {
		if (!cinRecto) {
			setCinRectoError("CIN Recto is required");
			return;
		}
		if (!cinVerso) {
			setCinVersoError("CIN Verso is required");
			return;
		}

		setSending(true);
		try {
			const [cinRectoUrl, cinVersoUrl] = await Promise.all([
				uploadToR2(cinRecto, "doctor-applications"),
				uploadToR2(cinVerso, "doctor-applications"),
			]);

			await createDoctorApplication({
				firstName: values.firstName,
				lastName: values.lastName,
				cabinetName: values.cabinetName,
				cabinetCityId: Number(values.cabinetCityId),
				cabinetLatitude: values.cabinetLatitude,
				cabinetLongitude: values.cabinetLongitude,
				specialityId: Number(values.specialityId),
				tin: values.tin,
				cinRecto: cinRectoUrl,
				cinVerso: cinVersoUrl,
			});

			toast.success("Application submitted successfully");
			onApplicationSubmitted();
		} catch {
			toast.error("Failed to submit application");
		} finally {
			setSending(false);
		}
	}

	return (
		<div>
			<h3 className="mt-5 font-semibold text-xl">Your Information</h3>
			<div className="mt-4">
				<Label>Email</Label>
				<div className="bg-muted px-3 py-1.5 rounded-md text-muted-foreground text-sm">
					{user?.email}
				</div>
			</div>

			<form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
				<div className="gap-3 grid grid-cols-2">
					<div>
						<Label htmlFor="firstName">
							First Name <span className="text-destructive">*</span>
						</Label>
						<Input
							id="firstName"
							placeholder="John"
							{...register("firstName")}
						/>
						{errors.firstName && (
							<p className="mt-1 text-destructive text-sm">
								{errors.firstName.message}
							</p>
						)}
					</div>
					<div>
						<Label htmlFor="lastName">
							Last Name <span className="text-destructive">*</span>
						</Label>
						<Input id="lastName" placeholder="Doe" {...register("lastName")} />
						{errors.lastName && (
							<p className="mt-1 text-destructive text-sm">
								{errors.lastName.message}
							</p>
						)}
					</div>
				</div>

				<div className="my-6 bg-border h-px" />
				<h3 className="font-semibold text-xl">Business Information</h3>

				<div>
					<Label htmlFor="tin">
						TIN (Tax Identification Number){" "}
						<span className="text-destructive">*</span>
					</Label>
					<Input id="tin" placeholder="1234567X" {...register("tin")} />
					{errors.tin && (
						<p className="mt-1 text-destructive text-sm">
							{errors.tin.message}
						</p>
					)}
				</div>

				<div>
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

				<div>
					<Label>
						Exact Location <span className="text-destructive">*</span>
					</Label>
					<div
						ref={mapContainerRef}
						className={cn(
							"mt-2 transition-all duration-300 bg-background relative z-10",
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
								className={
									isFullscreen ? "h-[100dvh] rounded-none" : "h-[500px]"
								}
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

				<div>
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

				<div>
					<Label>
						Speciality <span className="text-destructive">*</span>
					</Label>
					<SpecialitySelect
						specialities={specialities}
						value={specialityId}
						onChange={(v) =>
							setValue("specialityId", v, { shouldValidate: true })
						}
					/>
					{errors.specialityId && (
						<p className="mt-1 text-destructive text-sm">
							{errors.specialityId.message}
						</p>
					)}
				</div>

				<div className="gap-4 grid lg:grid-cols-2 mt-4">
					<div>
						<Label>
							CIN Recto <span className="text-destructive">*</span>
						</Label>
						<input
							ref={cinRectoRef}
							type="file"
							accept="image/*"
							className="hidden"
							onChange={(e) => {
								const f = e.target.files?.[0];
								if (f) handleCinFile("recto", f);
							}}
						/>
						<button
							type="button"
							onClick={() => cinRectoRef.current?.click()}
							aria-label="Upload CIN recto. Example card shown faded."
							className="block relative mt-2 border-2 hover:border-primary border-dashed rounded-lg w-full max-w-[300px] aspect-[14/9] overflow-hidden transition"
						>
							{cinRecto ? (
								// biome-ignore lint/performance/noImgElement: blob URL preview, next/image doesn't support blob URLs
								<img
									src={URL.createObjectURL(cinRecto)}
									alt="CIN Recto"
									className="w-full object-cover aspect-[14/9]"
								/>
							) : (
								<CinPlaceholder src="/cin_recto_placeholder.jpg" />
							)}
						</button>
						{cinRectoError && (
							<p className="mt-1 text-destructive text-sm">{cinRectoError}</p>
						)}
					</div>
					<div>
						<Label>
							CIN Verso <span className="text-destructive">*</span>
						</Label>
						<input
							ref={cinVersoRef}
							type="file"
							accept="image/*"
							className="hidden"
							onChange={(e) => {
								const f = e.target.files?.[0];
								if (f) handleCinFile("verso", f);
							}}
						/>
						<button
							type="button"
							onClick={() => cinVersoRef.current?.click()}
							aria-label="Upload CIN verso. Example card shown faded."
							className="block relative mt-2 border-2 hover:border-primary border-dashed rounded-lg w-full max-w-[300px] aspect-[14/9] overflow-hidden transition"
						>
							{cinVerso ? (
								// biome-ignore lint/performance/noImgElement: blob URL preview, next/image doesn't support blob URLs
								<img
									src={URL.createObjectURL(cinVerso)}
									alt="CIN Verso"
									className="w-full object-cover aspect-[14/9]"
								/>
							) : (
								<CinPlaceholder src="/cin_verso_placeholder.jpg" />
							)}
						</button>
						{cinVersoError && (
							<p className="mt-1 text-destructive text-sm">{cinVersoError}</p>
						)}
					</div>
				</div>

				<Button type="submit" className="mt-4 w-full" disabled={sending}>
					{sending ? "Submitting..." : "Apply For Verification"}
				</Button>
			</form>
		</div>
	);
}
