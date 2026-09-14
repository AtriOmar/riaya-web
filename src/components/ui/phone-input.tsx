"use client";

import type { CountryCode } from "libphonenumber-js";
import type { KeyboardEventHandler } from "react";
import { useEffect, useId, useState } from "react";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { PhoneCountryCombobox } from "@/components/ui/phone-country-combobox";
import {
	phoneCountryFromValue,
	phoneNationalInputDisplay,
	phoneValueFromNationalInput,
} from "@/lib/phone";
import { cn } from "@/lib/utils";

type Props = {
	/** Stored form value (digits with country code, any legacy shape). */
	value: string;
	onChange: (value: string) => void;
	onBlur?: () => void;
	onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
	id?: string;
	disabled?: boolean;
	className?: string;
	placeholder?: string;
	"aria-invalid"?: boolean;
};

/**
 * Phone field with shadcn country combobox (flag + calling code) and national
 * number input. Emits E.164 (`+216…`) via onChange; normalize with
 * `normalizePhoneForStorage` before API calls.
 */
export function PhoneNumberInput({
	value,
	onChange,
	onBlur,
	onKeyDown,
	id,
	disabled,
	className,
	placeholder = "Phone number",
	"aria-invalid": ariaInvalid,
}: Props) {
	const countryFieldId = useId();
	const [country, setCountry] = useState<CountryCode>(() =>
		phoneCountryFromValue(value),
	);

	useEffect(() => {
		setCountry(phoneCountryFromValue(value));
	}, [value]);

	const nationalDisplay = phoneNationalInputDisplay(value, country);

	const handleCountryChange = (nextCountry: CountryCode) => {
		setCountry(nextCountry);
		if (!value.trim()) return;
		const digits = phoneNationalInputDisplay(value, country).replace(/\D/g, "");
		if (!digits) return;
		onChange(phoneValueFromNationalInput(digits, nextCountry));
	};

	const handleNationalChange = (nextNational: string) => {
		onChange(phoneValueFromNationalInput(nextNational, country));
	};

	return (
		<InputGroup
			className={cn("w-full", className)}
			data-disabled={disabled ? true : undefined}
		>
			<InputGroupAddon align="inline-start" className="pl-1.5">
				<PhoneCountryCombobox
					id={countryFieldId}
					value={country}
					onChange={handleCountryChange}
					disabled={disabled}
				/>
			</InputGroupAddon>
			<InputGroupInput
				id={id}
				type="tel"
				inputMode="tel"
				autoComplete="tel-national"
				disabled={disabled}
				aria-invalid={ariaInvalid}
				placeholder={placeholder}
				value={nationalDisplay}
				onChange={(e) => handleNationalChange(e.target.value)}
				onBlur={onBlur}
				onKeyDown={onKeyDown}
			/>
		</InputGroup>
	);
}
