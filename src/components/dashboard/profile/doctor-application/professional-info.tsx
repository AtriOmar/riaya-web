import { Layers, Upload, X } from "lucide-react";
import { useRef } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Speciality } from "@/services/types";
import type { FormValues } from "./schema";
import SpecialitySelect from "./speciality-select";

type Props = {
	specialities: Speciality[];
	medicalCouncilCertificate: File | null;
	setMedicalCouncilCertificate: (f: File | null) => void;
	medicalCouncilCertificateError: string | null;
	handleMedicalCouncilCertificateFile: (file: File) => void;
};

export default function ProfessionalInfo({
	specialities,
	medicalCouncilCertificate,
	setMedicalCouncilCertificate,
	medicalCouncilCertificateError,
	handleMedicalCouncilCertificateFile,
}: Props) {
	const {
		register,
		formState: { errors },
		setValue,
		watch,
	} = useFormContext<FormValues>();
	const specialityId = watch("specialityId");
	const medicalCouncilCertificateRef = useRef<HTMLInputElement>(null);

	return (
		<div>
			<div className="bg-border my-6 h-px" />
			<h3 className="font-semibold text-xl">Professional Information</h3>

			<div className="space-y-2 mt-4">
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

			<div className="space-y-2 mt-4">
				<Label htmlFor="medicalCouncilNumber">
					Medical Council Registration Number{" "}
					<span className="text-destructive">*</span>
				</Label>
				<Input
					id="medicalCouncilNumber"
					placeholder="12345/M"
					{...register("medicalCouncilNumber")}
				/>
				{errors.medicalCouncilNumber && (
					<p className="mt-1 text-destructive text-sm">
						{errors.medicalCouncilNumber.message}
					</p>
				)}
			</div>

			<div className="mt-4">
				<div className="space-y-2">
					<Label>
						Medical Council Certificate (Attestation d'inscription){" "}
						<span className="text-destructive">*</span>
					</Label>
					<input
						ref={medicalCouncilCertificateRef}
						type="file"
						accept="image/*,.pdf"
						className="hidden"
						onChange={(e) => {
							const f = e.target.files?.[0];
							if (f) handleMedicalCouncilCertificateFile(f);
						}}
					/>
					<div className="relative mt-2 w-full max-w-[300px]">
						<button
							type="button"
							onClick={() => medicalCouncilCertificateRef.current?.click()}
							aria-label="Upload Medical Council Certificate"
							className="block border-2 hover:border-primary border-dashed rounded-lg w-full h-full aspect-[14/9] overflow-hidden transition"
						>
							{medicalCouncilCertificate ? (
								medicalCouncilCertificate.type.startsWith("image/") ? (
									// biome-ignore lint/performance/noImgElement: blob URL preview
									<img
										src={URL.createObjectURL(medicalCouncilCertificate)}
										alt="Medical Council Certificate"
										className="w-full object-cover aspect-[14/9]"
									/>
								) : medicalCouncilCertificate.type === "application/pdf" ? (
									<object
										data={URL.createObjectURL(medicalCouncilCertificate)}
										type="application/pdf"
										className="w-full h-full aspect-[14/9] pointer-events-none"
									>
										<div className="flex flex-col justify-center items-center bg-muted/50 w-full h-full text-sm">
											<Layers className="mb-2 size-8 text-muted-foreground" />
											<span className="px-4 max-w-[90%] font-medium text-center truncate">
												{medicalCouncilCertificate.name}
											</span>
											<span className="mt-1 text-muted-foreground text-xs">
												PDF Selected
											</span>
										</div>
									</object>
								) : (
									<div className="flex flex-col justify-center items-center bg-muted/50 w-full h-full text-sm">
										<Layers className="mb-2 size-8 text-muted-foreground" />
										<span className="px-4 max-w-[90%] font-medium text-center truncate">
											{medicalCouncilCertificate.name}
										</span>
									</div>
								)
							) : (
								<div className="flex flex-col justify-center items-center bg-muted/20 w-full h-full text-muted-foreground hover:text-primary transition-colors">
									<Upload className="mb-2 size-8" />
									<span className="font-medium text-sm">
										Click to upload document
									</span>
									<span className="opacity-70 mt-1 text-xs">Image or PDF</span>
								</div>
							)}
						</button>
						{medicalCouncilCertificate && (
							<Button
								type="button"
								variant="destructive"
								size="icon"
								className="-top-2 -right-2 z-10 absolute shadow-sm rounded-full size-7"
								onClick={(e) => {
									e.stopPropagation();
									setMedicalCouncilCertificate(null);
									if (medicalCouncilCertificateRef.current)
										medicalCouncilCertificateRef.current.value = "";
								}}
							>
								<X className="size-4" />
							</Button>
						)}
					</div>
					{medicalCouncilCertificateError && (
						<p className="mt-1 text-destructive text-sm">
							{medicalCouncilCertificateError}
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
