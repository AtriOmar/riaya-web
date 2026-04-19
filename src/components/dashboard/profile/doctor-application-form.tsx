"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth } from "@/components/contexts/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { uploadToR2 } from "@/lib/upload";
import { createDoctorApplication } from "@/services";
import type { Speciality } from "@/services/types";
import SpecialitySelect from "./speciality-select";

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
	cabinetCityId: z
		.string()
		.regex(/^\d+$/, "Cabinet city ID must be a valid number"),
	specialityId: z.string().min(1, "Speciality is required"),
	tin: z
		.string()
		.regex(/^\d{7}[A-Z]$/, "Format: 0000000X (7 digits + uppercase letter)"),
});

type FormValues = z.infer<typeof schema>;

type Props = {
	specialities: Speciality[];
	onApplicationSubmitted: () => void;
};

export default function DoctorApplicationForm({
	specialities,
	onApplicationSubmitted,
}: Props) {
	const { user } = useAuth();

	const [cinRecto, setCinRecto] = useState<File | null>(null);
	const [cinVerso, setCinVerso] = useState<File | null>(null);
	const [cinRectoError, setCinRectoError] = useState<string | null>(null);
	const [cinVersoError, setCinVersoError] = useState<string | null>(null);
	const [sending, setSending] = useState(false);
	const [_cinModal, setCinModal] = useState<{
		side: "recto" | "verso";
		imageUrl: string;
	} | null>(null);

	const cinRectoRef = useRef<HTMLInputElement>(null);
	const cinVersoRef = useRef<HTMLInputElement>(null);

	const {
		register,
		handleSubmit,
		formState: { errors },
		setValue,
		watch,
	} = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: {
			firstName: "",
			lastName: "",
			cabinetName: "",
			cabinetCityId: "",
			specialityId: "",
			tin: "",
		},
	});

	const specialityId = watch("specialityId");

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
				<div className="px-3 py-1.5 rounded-md bg-muted text-muted-foreground text-sm">
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

				<div className="h-px my-6 bg-border" />
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
					<Label htmlFor="cabinetCityId">
						Cabinet City ID <span className="text-destructive">*</span>
					</Label>
					<Input
						id="cabinetCityId"
						placeholder="1"
						{...register("cabinetCityId")}
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
							className="block w-full max-w-[300px] aspect-[14/9] overflow-hidden mt-2 border-2 hover:border-primary border-dashed rounded-lg transition"
						>
							{cinRecto ? (
								// biome-ignore lint/performance/noImgElement: blob URL preview, next/image doesn't support blob URLs
								<img
									src={URL.createObjectURL(cinRecto)}
									alt="CIN Recto"
									className="w-full h-full object-cover"
								/>
							) : (
								<div className="flex justify-center items-center h-full text-muted-foreground text-sm">
									Click to upload
								</div>
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
							className="block w-full max-w-[300px] aspect-[14/9] overflow-hidden mt-2 border-2 hover:border-primary border-dashed rounded-lg transition"
						>
							{cinVerso ? (
								// biome-ignore lint/performance/noImgElement: blob URL preview, next/image doesn't support blob URLs
								<img
									src={URL.createObjectURL(cinVerso)}
									alt="CIN Verso"
									className="w-full h-full object-cover"
								/>
							) : (
								<div className="flex justify-center items-center h-full text-muted-foreground text-sm">
									Click to upload
								</div>
							)}
						</button>
						{cinVersoError && (
							<p className="mt-1 text-destructive text-sm">{cinVersoError}</p>
						)}
					</div>
				</div>

				<Button type="submit" className="w-full mt-4" disabled={sending}>
					{sending ? "Submitting..." : "Apply For Verification"}
				</Button>
			</form>
		</div>
	);
}
