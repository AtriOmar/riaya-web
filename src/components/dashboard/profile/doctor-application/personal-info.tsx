import { Upload, X } from "lucide-react";
import Image from "next/image";
import { useRef } from "react";
import { useFormContext } from "react-hook-form";
import { useAuth } from "@/components/contexts/auth-provider";
import { Button } from "@/components/ui/button";
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

type Props = {
	cinRecto: File | null;
	setCinRecto: (f: File | null) => void;
	cinRectoError: string | null;
	cinVerso: File | null;
	setCinVerso: (f: File | null) => void;
	cinVersoError: string | null;
	handleCinFile: (side: "recto" | "verso", file: File) => void;
};

export default function PersonalInfo({
	cinRecto,
	setCinRecto,
	cinRectoError,
	cinVerso,
	setCinVerso,
	cinVersoError,
	handleCinFile,
}: Props) {
	const {
		register,
		formState: { errors },
	} = useFormContext<FormValues>();
	const { user } = useAuth();
	const cinRectoRef = useRef<HTMLInputElement>(null);
	const cinVersoRef = useRef<HTMLInputElement>(null);

	return (
		<div>
			<h3 className="mt-5 font-semibold text-xl">Your Information</h3>

			<div className="space-y-2 mt-4">
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
							if (f) handleCinFile("recto", f);
						}}
					/>
					<div className="relative mt-2 w-full max-w-[300px]">
						<button
							type="button"
							onClick={() => cinRectoRef.current?.click()}
							aria-label="Upload CIN recto. Example card shown faded."
							className="block border-2 hover:border-primary border-dashed rounded-lg w-full h-full aspect-[14/9] overflow-hidden transition"
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
						{cinRecto && (
							<Button
								type="button"
								variant="destructive"
								size="icon"
								className="-top-2 -right-2 z-10 absolute shadow-sm rounded-full size-7"
								onClick={(e) => {
									e.stopPropagation();
									setCinRecto(null);
									if (cinRectoRef.current) cinRectoRef.current.value = "";
								}}
							>
								<X className="size-4" />
							</Button>
						)}
					</div>
					{cinRectoError && (
						<p className="mt-1 text-destructive text-sm">{cinRectoError}</p>
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
							if (f) handleCinFile("verso", f);
						}}
					/>
					<div className="relative mt-2 w-full max-w-[300px]">
						<button
							type="button"
							onClick={() => cinVersoRef.current?.click()}
							aria-label="Upload CIN verso. Example card shown faded."
							className="block border-2 hover:border-primary border-dashed rounded-lg w-full h-full aspect-[14/9] overflow-hidden transition"
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
						{cinVerso && (
							<Button
								type="button"
								variant="destructive"
								size="icon"
								className="-top-2 -right-2 z-10 absolute shadow-sm rounded-full size-7"
								onClick={(e) => {
									e.stopPropagation();
									setCinVerso(null);
									if (cinVersoRef.current) cinVersoRef.current.value = "";
								}}
							>
								<X className="size-4" />
							</Button>
						)}
					</div>
					{cinVersoError && (
						<p className="mt-1 text-destructive text-sm">{cinVersoError}</p>
					)}
				</div>
			</div>
		</div>
	);
}
