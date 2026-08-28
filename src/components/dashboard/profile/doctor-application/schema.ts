import { z } from "zod";

export const schema = z.object({
	firstName: z.string().min(1, "First name is required"),
	lastName: z.string().min(1, "Last name is required"),
	cabinetName: z.string().min(1, "Cabinet name is required"),
	cabinetCityId: z.string().min(1, "City is required"),
	cabinetLatitude: z.number({
		message: "Exact location is required",
	}),
	cabinetLongitude: z.number({
		message: "Exact location is required",
	}),
	specialityId: z.string().min(1, "Speciality is required"),
	tin: z
		.string()
		.regex(/^\d{7}[A-Z]$/, "Format: 0000000X (7 digits + uppercase letter)"),
	medicalCouncilNumber: z.string().min(1, "Registration number is required"),
});

export type FormValues = z.infer<typeof schema>;
