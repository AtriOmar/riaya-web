"use client";

import { useState } from "react";
import { toast } from "sonner";
import LanguageSelect from "@/components/dashboard/language-select";
import { getErrorMessage } from "@/lib/error-handling";
import type { Language } from "@/lib/language";
import { putApiDoctorsMeNoteLanguage } from "@/services/generated/doctors/doctors";

/** Default language of the AI consultation notes written from the doctor's recordings. */
export default function NoteLanguage({
	value,
	onSaved,
}: {
	value: Language;
	onSaved: () => void;
}) {
	const [saving, setSaving] = useState(false);

	async function change(next: Language) {
		if (next === value) return;
		setSaving(true);
		try {
			await putApiDoctorsMeNoteLanguage({ noteLanguage: next });
			onSaved();
			toast.success("Saved. New consultation notes will use this language.");
		} catch (err) {
			toast.error(getErrorMessage(err));
		} finally {
			setSaving(false);
		}
	}

	return (
		<section className="mt-6 space-y-3">
			<div>
				<h4 className="font-semibold text-lg">Consultation notes</h4>
				<p className="text-muted-foreground text-sm">
					The language of the AI notes written from your recordings. Notes you
					already have stay as they are, and you can pick another language when
					you rewrite one.
				</p>
			</div>
			<div className="max-w-xs">
				<LanguageSelect
					value={value}
					onChange={change}
					disabled={saving}
					label="Note language"
				/>
			</div>
		</section>
	);
}
