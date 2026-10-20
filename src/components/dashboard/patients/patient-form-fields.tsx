"use client";

import {
	differenceInMonths,
	differenceInYears,
	format,
	isValid,
	parse,
} from "date-fns";
import { CalendarDays } from "lucide-react";
import {
	type KeyboardEvent,
	type ReactNode,
	type RefObject,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";
import { Controller, useFormContext } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneNumberInput } from "@/components/ui/phone-input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { isValidPhoneNumber } from "@/lib/phone";
import { cn } from "@/lib/utils";

/** Parses a `YYYY-MM-DD` birth date; null unless it is a real date in the past. */
function parseBirthDate(value: string): Date | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	const date = parse(value, "yyyy-MM-dd", new Date());
	if (!isValid(date) || date > new Date() || date.getFullYear() < 1900) {
		return null;
	}
	return date;
}

/** Fields shared by the create and edit patient forms. */
export const patientFieldsSchema = z.object({
	firstName: z.string().trim().min(1, "First name is required"),
	lastName: z.string().trim().min(1, "Last name is required"),
	dateOfBirth: z
		.string()
		.min(1, "Date of birth is required")
		.refine((v) => parseBirthDate(v) !== null, "Enter a real date in the past"),
	gender: z.string().min(1, "Choose a gender"),
	cin: z.string().trim().min(1, "CIN is required"),
	phoneNumber: z
		.string()
		.min(1, "Phone number is required")
		.refine((v) => isValidPhoneNumber(v), "Enter a valid phone number"),
	address: z.string(),
});

export type PatientFieldsValues = z.infer<typeof patientFieldsSchema>;

const GENDERS = [
	{ value: "male", label: "Male" },
	{ value: "female", label: "Female" },
] as const;

/** Label, control, then either the error or a hint. */
export function Field({
	label,
	htmlFor,
	optional,
	hint,
	error,
	className,
	children,
}: {
	label: ReactNode;
	htmlFor?: string;
	optional?: boolean;
	hint?: ReactNode;
	error?: string;
	className?: string;
	children: ReactNode;
}) {
	return (
		<div className={cn("flex flex-col gap-1.5", className)}>
			<Label htmlFor={htmlFor}>
				{label}
				{optional && (
					<span className="font-normal text-muted-foreground">(optional)</span>
				)}
			</Label>
			{children}
			{error ? (
				<p className="text-destructive text-xs">{error}</p>
			) : (
				hint && <p className="text-muted-foreground text-xs">{hint}</p>
			)}
		</div>
	);
}

/** A row of toggle buttons where exactly one option is picked. */
export function ChoiceChips<T extends string>({
	options,
	value,
	onChange,
	label,
	invalid,
	stretch,
}: {
	options: readonly { value: T; label: string }[];
	value: string | undefined;
	onChange: (value: T) => void;
	label: string;
	invalid?: boolean;
	/** Make every option the same width and fill the row. */
	stretch?: boolean;
}) {
	return (
		<fieldset
			aria-label={label}
			className={cn("flex flex-wrap gap-1.5", stretch && "flex-nowrap")}
		>
			{options.map((o) => {
				const selected = value === o.value;
				return (
					<button
						key={o.value}
						type="button"
						aria-pressed={selected}
						onClick={() => onChange(o.value)}
						className={cn(
							"h-8 rounded-md border px-3 font-medium text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
							stretch && "flex-1",
							selected
								? "border-primary bg-primary text-primary-foreground"
								: "border-input bg-background hover:bg-accent dark:bg-input/30",
							invalid && !selected && "border-destructive",
						)}
					>
						{o.label}
					</button>
				);
			})}
		</fieldset>
	);
}

type DateParts = { day: string; month: string; year: string };

function partsFromValue(value: string): DateParts {
	const [year = "", month = "", day = ""] = value ? value.split("-") : [];
	return { day, month, year };
}

function valueFromParts({ day, month, year }: DateParts): string {
	if (!day && !month && !year) return "";
	return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

const EARLIEST_BIRTH_MONTH = new Date(1900, 0);

/**
 * Day / month / year boxes to type into, plus a calendar (with month and year
 * dropdowns) for those who prefer picking. Emits `YYYY-MM-DD`, possibly
 * incomplete, so the schema can report it.
 */
function DateOfBirthInput({
	id,
	value,
	onChange,
	onBlur,
	invalid,
}: {
	id: string;
	value: string;
	onChange: (value: string) => void;
	onBlur: () => void;
	invalid?: boolean;
}) {
	const [parts, setParts] = useState(() => partsFromValue(value));
	const monthRef = useRef<HTMLInputElement>(null);
	const yearRef = useRef<HTMLInputElement>(null);
	const dayRef = useRef<HTMLInputElement>(null);
	const [calendarOpen, setCalendarOpen] = useState(false);
	const selected = parseBirthDate(value) ?? undefined;

	// Follow outside changes (form reset) without fighting the user's typing.
	useEffect(() => {
		if (value !== valueFromParts(parts)) setParts(partsFromValue(value));
	}, [value]);

	function update(key: keyof DateParts, raw: string, max: number) {
		const digits = raw.replace(/\D/g, "").slice(0, max);
		const next = { ...parts, [key]: digits };
		setParts(next);
		onChange(valueFromParts(next));
		if (digits.length === max) {
			if (key === "day") monthRef.current?.focus();
			if (key === "month") yearRef.current?.focus();
		}
	}

	function backTo(
		prev: RefObject<HTMLInputElement | null>,
		key: keyof DateParts,
	) {
		return (e: KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Backspace" && parts[key] === "") prev.current?.focus();
		};
	}

	function pick(date: Date | undefined) {
		if (!date) return;
		const next = format(date, "yyyy-MM-dd");
		setParts(partsFromValue(next));
		onChange(next);
		setCalendarOpen(false);
	}

	/** Open on the picked date, else on what was typed so far, else 30 years back. */
	function initialMonth(): Date {
		if (selected) return selected;
		const today = new Date();
		const year = parts.year.length === 4 ? Number(parts.year) : null;
		const month = Number(parts.month);
		if (year && year >= 1900 && year <= today.getFullYear()) {
			return new Date(year, month >= 1 && month <= 12 ? month - 1 : 0);
		}
		return new Date(today.getFullYear() - 30, today.getMonth());
	}

	const box =
		"h-8 text-center tabular-nums placeholder:text-muted-foreground/60";

	return (
		<div className="flex items-center gap-1.5">
			<Input
				ref={dayRef}
				id={id}
				inputMode="numeric"
				autoComplete="bday-day"
				aria-label="Day"
				placeholder="DD"
				className={cn(box, "w-12")}
				value={parts.day}
				onChange={(e) => update("day", e.target.value, 2)}
				onBlur={onBlur}
				aria-invalid={invalid}
			/>
			<span className="text-muted-foreground">/</span>
			<Input
				ref={monthRef}
				inputMode="numeric"
				autoComplete="bday-month"
				aria-label="Month"
				placeholder="MM"
				className={cn(box, "w-12")}
				value={parts.month}
				onChange={(e) => update("month", e.target.value, 2)}
				onKeyDown={backTo(dayRef, "month")}
				onBlur={onBlur}
				aria-invalid={invalid}
			/>
			<span className="text-muted-foreground">/</span>
			<Input
				ref={yearRef}
				inputMode="numeric"
				autoComplete="bday-year"
				aria-label="Year"
				placeholder="YYYY"
				className={cn(box, "w-16")}
				value={parts.year}
				onChange={(e) => update("year", e.target.value, 4)}
				onKeyDown={backTo(monthRef, "year")}
				onBlur={onBlur}
				aria-invalid={invalid}
			/>
			<Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
				<PopoverTrigger asChild>
					<Button
						type="button"
						variant="outline"
						size="icon"
						aria-label="Pick date of birth from a calendar"
					>
						<CalendarDays />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="p-0 w-auto" align="end">
					<Calendar
						mode="single"
						captionLayout="dropdown"
						selected={selected}
						onSelect={pick}
						defaultMonth={initialMonth()}
						startMonth={EARLIEST_BIRTH_MONTH}
						endMonth={new Date()}
						disabled={{ after: new Date() }}
					/>
				</PopoverContent>
			</Popover>
		</div>
	);
}

function ageLabel(value: string): string | null {
	const date = parseBirthDate(value);
	if (!date) return null;
	const years = differenceInYears(new Date(), date);
	if (years >= 2) return `${years} years old`;
	const months = differenceInMonths(new Date(), date);
	return months === 1 ? "1 month old" : `${months} months old`;
}

/** Name, birth date, gender and CIN. Needs a surrounding `FormProvider`. */
export function PatientPersonalFields() {
	const id = useId();
	const {
		register,
		control,
		watch,
		formState: { errors },
	} = useFormContext<PatientFieldsValues>();
	const age = ageLabel(watch("dateOfBirth"));

	return (
		<div className="gap-x-4 gap-y-5 grid sm:grid-cols-2">
			<Field
				label="First name"
				htmlFor={`${id}-first`}
				error={errors.firstName?.message}
			>
				<Input
					id={`${id}-first`}
					autoComplete="off"
					aria-invalid={!!errors.firstName}
					{...register("firstName")}
				/>
			</Field>
			<Field
				label="Last name"
				htmlFor={`${id}-last`}
				error={errors.lastName?.message}
			>
				<Input
					id={`${id}-last`}
					autoComplete="off"
					aria-invalid={!!errors.lastName}
					{...register("lastName")}
				/>
			</Field>
			<Field
				label="Date of birth"
				htmlFor={`${id}-dob`}
				error={errors.dateOfBirth?.message}
				hint={age ?? "Day, month, year"}
			>
				<Controller
					name="dateOfBirth"
					control={control}
					render={({ field }) => (
						<DateOfBirthInput
							id={`${id}-dob`}
							value={field.value}
							onChange={field.onChange}
							onBlur={field.onBlur}
							invalid={!!errors.dateOfBirth}
						/>
					)}
				/>
			</Field>
			<Field label="Gender" error={errors.gender?.message}>
				<Controller
					name="gender"
					control={control}
					render={({ field }) => (
						<ChoiceChips
							label="Gender"
							options={GENDERS}
							value={field.value}
							onChange={field.onChange}
							invalid={!!errors.gender}
							stretch
						/>
					)}
				/>
			</Field>
			<Field
				label="CIN"
				htmlFor={`${id}-cin`}
				error={errors.cin?.message}
				hint="National ID card number"
			>
				<Input
					id={`${id}-cin`}
					placeholder="AB123456"
					autoComplete="off"
					className="uppercase placeholder:normal-case"
					aria-invalid={!!errors.cin}
					{...register("cin")}
				/>
			</Field>
		</div>
	);
}

/**
 * Phone and address. `afterPhone` renders under the phone field (the create
 * form uses it for "this number belongs to someone else").
 */
export function PatientContactFields({
	afterPhone,
}: {
	afterPhone?: ReactNode;
}) {
	const id = useId();
	const {
		register,
		control,
		formState: { errors },
	} = useFormContext<PatientFieldsValues>();

	return (
		<div className="gap-y-5 grid">
			<div className="flex flex-col gap-3">
				<Field
					label="Phone number"
					htmlFor={`${id}-phone`}
					error={errors.phoneNumber?.message}
					className="sm:max-w-[calc(50%-0.5rem)]"
				>
					<Controller
						name="phoneNumber"
						control={control}
						render={({ field }) => (
							<PhoneNumberInput
								id={`${id}-phone`}
								value={field.value}
								onChange={field.onChange}
								onBlur={field.onBlur}
								aria-invalid={!!errors.phoneNumber}
							/>
						)}
					/>
				</Field>
				{afterPhone}
			</div>
			<Field label="Address" htmlFor={`${id}-address`} optional>
				<Input
					id={`${id}-address`}
					placeholder="Street, city, postal code"
					{...register("address")}
				/>
			</Field>
		</div>
	);
}
