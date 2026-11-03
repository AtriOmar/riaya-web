import { Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useRef } from "react";
import { useFormContext } from "react-hook-form";
import { useAuth } from "@/components/contexts/auth-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormValues } from "./schema";

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

export default function PersonalInfo() {
	const {
		register,
		formState: { errors },
		watch,
		setValue,
	} = useFormContext<FormValues>();
	const { user } = useAuth();
	const cinRecto = watch("cinRecto");
	const cinVerso = watch("cinVerso");
	const cinRectoRef = useRef<HTMLInputElement>(null);
	const cinVersoRef = useRef<HTMLInputElement>(null);

	return (
		<div>
			<div className="space-y-2 mt-6">
				<Label>Email</Label>
				<div className="bg-muted px-3 py-1.5 rounded-md text-muted-foreground text-sm">
					{user?.email}
				</div>
			</div>

			<div className="gap-3 grid grid-cols-2 mt-4">
				<div className="space-y-2">
					<Label htmlFor="firstName">
						First Name <span className="text-destructive">*</span>
					</Label>
					<Input id="firstName" placeholder="John" {...register("firstName")} />
					{errors.firstName && (
						<p className="mt-1 text-destructive text-sm">
							{errors.firstName.message}
						</p>
					)}
				</div>
				<div className="space-y-2">
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

			<div className="gap-4 grid lg:grid-cols-2 mt-4">
				<div className="space-y-2">
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
							if (f) setValue("cinRecto", f, { shouldValidate: true });
						}}
					/>
					<div className="relative mt-2 w-full max-w-[300px] group overflow-hidden rounded-lg border-2 border-dashed hover:border-primary transition">
						{cinRecto ? (
							<>
								{/* biome-ignore lint/performance/noImgElement: blob URL preview, next/image doesn't support blob URLs */}
								<img
									src={URL.createObjectURL(cinRecto)}
									alt="CIN Recto"
									className="w-full object-cover aspect-[14/9]"
								/>
								<div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col sm:flex-row gap-2 items-center justify-center transition-opacity duration-200">
									<button
										type="button"
										className="inline-flex items-center justify-center h-8 px-3 rounded-md text-xs font-medium transition-colors bg-green-500/40 border border-green-500/50 text-green-100 hover:bg-green-500/60 hover:text-white"
										onClick={(e) => {
											e.stopPropagation();
											cinRectoRef.current?.click();
										}}
									>
										<Upload className="size-4 mr-2" />
										Change
									</button>
									<button
										type="button"
										className="inline-flex items-center justify-center h-8 px-3 rounded-md text-xs font-medium transition-colors bg-red-500/40 border border-red-500/50 text-red-100 hover:bg-red-500/60 hover:text-white"
										onClick={(e) => {
											e.stopPropagation();
											setValue("cinRecto", undefined as never);
											if (cinRectoRef.current) cinRectoRef.current.value = "";
										}}
									>
										<Trash2 className="size-4 mr-2" />
										Remove
									</button>
								</div>
							</>
						) : (
							<button
								type="button"
								onClick={() => cinRectoRef.current?.click()}
								aria-label="Upload CIN recto. Example card shown faded."
								className="block w-full h-full aspect-[14/9]"
							>
								<CinPlaceholder src="/cin_recto_placeholder.jpg" />
							</button>
						)}
					</div>
					{errors.cinRecto && (
						<p className="mt-1 text-destructive text-sm">
							{errors.cinRecto.message}
						</p>
					)}
				</div>
				<div className="space-y-2">
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
							if (f) setValue("cinVerso", f, { shouldValidate: true });
						}}
					/>
					<div className="relative mt-2 w-full max-w-[300px] group overflow-hidden rounded-lg border-2 border-dashed hover:border-primary transition">
						{cinVerso ? (
							<>
								{/* biome-ignore lint/performance/noImgElement: blob URL preview, next/image doesn't support blob URLs */}
								<img
									src={URL.createObjectURL(cinVerso)}
									alt="CIN Verso"
									className="w-full object-cover aspect-[14/9]"
								/>
								<div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col sm:flex-row gap-2 items-center justify-center transition-opacity duration-200">
									<button
										type="button"
										className="inline-flex items-center justify-center h-8 px-3 rounded-md text-xs font-medium transition-colors bg-green-500/40 border border-green-500/50 text-green-100 hover:bg-green-500/60 hover:text-white"
										onClick={(e) => {
											e.stopPropagation();
											cinVersoRef.current?.click();
										}}
									>
										<Upload className="size-4 mr-2" />
										Change
									</button>
									<button
										type="button"
										className="inline-flex items-center justify-center h-8 px-3 rounded-md text-xs font-medium transition-colors bg-red-500/40 border border-red-500/50 text-red-100 hover:bg-red-500/60 hover:text-white"
										onClick={(e) => {
											e.stopPropagation();
											setValue("cinVerso", undefined as never);
											if (cinVersoRef.current) cinVersoRef.current.value = "";
										}}
									>
										<Trash2 className="size-4 mr-2" />
										Remove
									</button>
								</div>
							</>
						) : (
							<button
								type="button"
								onClick={() => cinVersoRef.current?.click()}
								aria-label="Upload CIN verso. Example card shown faded."
								className="block w-full h-full aspect-[14/9]"
							>
								<CinPlaceholder src="/cin_verso_placeholder.jpg" />
							</button>
						)}
					</div>
					{errors.cinVerso && (
						<p className="mt-1 text-destructive text-sm">
							{errors.cinVerso.message}
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
