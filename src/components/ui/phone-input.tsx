"use client";

import PhoneInput, { type Country, type Value } from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import en from "react-phone-number-input/locale/en";
import { DEFAULT_PHONE_COUNTRY, phoneInputValueFromStorage } from "@/lib/phone";
import { cn } from "@/lib/utils";

import "react-phone-number-input/style.css";

type Props = {
	/** Stored form value (digits with country code, any legacy shape). */
	value: string;
	onChange: (value: string) => void;
	onBlur?: () => void;
	id?: string;
	disabled?: boolean;
	className?: string;
	"aria-invalid"?: boolean;
};

/**
 * Tunisia-only phone field with country flag. Emits E.164 (`+216…`) via onChange
 * for live formatting; normalize with `normalizePhoneForStorage` before API calls.
 */
export function PhoneNumberInput({
	value,
	onChange,
	onBlur,
	id,
	disabled,
	className,
	"aria-invalid": ariaInvalid,
}: Props) {
	const inputValue = phoneInputValueFromStorage(value) as Value | undefined;

	return (
		<div
			className={cn(
				"phone-input-root",
				ariaInvalid && "phone-input-root--invalid",
				className,
			)}
		>
			<PhoneInput
				id={id}
				international
				defaultCountry={DEFAULT_PHONE_COUNTRY}
				countries={[DEFAULT_PHONE_COUNTRY] as Country[]}
				countryCallingCodeEditable={false}
				countrySelectProps={{ disabled: true, tabIndex: -1 }}
				flags={flags}
				labels={en}
				value={inputValue}
				onChange={(next) => onChange(next ?? "")}
				onBlur={onBlur}
				disabled={disabled}
				numberInputProps={{
					className: "PhoneInputInput",
					"aria-invalid": ariaInvalid,
				}}
			/>
		</div>
	);
}
