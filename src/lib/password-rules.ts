import { z } from "zod";

export const PASSWORD_RULES = [
	{
		id: "length",
		label: "At least 8 characters",
		test: (password: string) => password.length >= 8,
	},
	{
		id: "letter",
		label: "Contains a letter",
		test: (password: string) => /[a-zA-Z]/.test(password),
	},
	{
		id: "number",
		label: "Contains a number",
		test: (password: string) => /[0-9]/.test(password),
	},
] as const;

export const passwordSchema = z
	.string()
	.min(8, "Password must be at least 8 characters")
	.regex(/(?=.*[a-zA-Z])(?=.*[0-9])/, "Must contain letters and numbers");
