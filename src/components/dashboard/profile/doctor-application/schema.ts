import { z } from "zod";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const requiredFile = (message: string) =>
	z
		.instanceof(File, { message })
		.refine((f) => f.size <= MAX_FILE_SIZE, "File size exceeds 5MB");

export const schema = z.object({
	firstName: z.string().min(1, "First name is required"),
	lastName: z.string().min(1, "Last name is required"),
	cinRecto: requiredFile("CIN recto is required"),
	cinVerso: requiredFile("CIN verso is required"),
	specialityId: z.string().min(1, "Speciality is required"),
	medicalCouncilNumber: z.string().min(1, "Registration number is required"),
	medicalCouncilCertificate: requiredFile(
		"Medical Council Certificate is required",
	),
	cabinetName: z.string().min(1, "Cabinet name is required"),
	tin: z
		.string()
		.regex(/^\d{7}[A-Z]$/, "Format: 0000000X (7 digits + uppercase letter)"),
	cabinetCityId: z.string().min(1, "City is required"),
	cabinetAddress: z.string().trim().min(1, "Address is required").max(500),
	cabinetLatitude: z.number({
		message: "Exact location is required",
	}),
	cabinetLongitude: z.number({
		message: "Exact location is required",
	}),
});

export type FormValues = z.infer<typeof schema>;

export const steps = [
	{
		title: "Identity",
		fields: ["firstName", "lastName", "cinRecto", "cinVerso"],
	},
	{
		title: "Professional",
		fields: [
			"specialityId",
			"medicalCouncilNumber",
			"medicalCouncilCertificate",
		],
	},
	{
		title: "Cabinet",
		fields: [
			"cabinetName",
			"tin",
			"cabinetCityId",
			"cabinetAddress",
			"cabinetLatitude",
			"cabinetLongitude",
		],
	},
] as const satisfies { title: string; fields: (keyof FormValues)[] }[];

/** Index of the first step whose fields don't all pass validation yet. */
export function firstIncompleteStep(values: Partial<FormValues>): number {
	const index = steps.findIndex((step) => {
		const pick = Object.fromEntries(step.fields.map((f) => [f, true])) as {
			[K in (typeof step.fields)[number]]: true;
		};
		return !schema.pick(pick).safeParse(values).success;
	});
	return index === -1 ? steps.length - 1 : index;
}
