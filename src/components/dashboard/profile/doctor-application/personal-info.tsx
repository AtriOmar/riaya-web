import { useFormContext } from "react-hook-form";
import { useAuth } from "@/components/contexts/auth-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CinField from "./cin-field";
import type { FormValues } from "./schema";

export default function PersonalInfo() {
	const {
		register,
		formState: { errors },
	} = useFormContext<FormValues>();
	const { user } = useAuth();

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
				<CinField
					name="cinRecto"
					label="CIN Recto"
					placeholderSrc="/cin_recto_placeholder.jpg"
				/>
				<CinField
					name="cinVerso"
					label="CIN Verso"
					placeholderSrc="/cin_verso_placeholder.jpg"
				/>
			</div>
		</div>
	);
}
