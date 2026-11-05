import { useEffect, useRef, useState } from "react";
import type {
	DefaultValues,
	FieldValues,
	UseFormReset,
	UseFormWatch,
} from "react-hook-form";
import { delIDB, getIDB, setIDB } from "@/lib/idb";

type Draft<TFieldValues> = {
	values: Partial<TFieldValues>;
	timestamp: number;
};

interface UseFormDraftProps<TFieldValues extends FieldValues> {
	draftKey: string;
	watch: UseFormWatch<TFieldValues>;
	reset: UseFormReset<TFieldValues>;
	/** Called once the draft has been restored (or found missing/expired). */
	onRestored?: (values: Partial<TFieldValues> | null) => void;
	/** Maximum age of the draft in milliseconds. Defaults to 24 hours. */
	maxAgeMs?: number;
}

/**
 * Persists a form's values to IndexedDB so a refresh doesn't lose them.
 * IndexedDB (not localStorage) because values can hold File objects.
 */
export function useFormDraft<TFieldValues extends FieldValues>({
	draftKey,
	watch,
	reset,
	onRestored,
	maxAgeMs = 24 * 60 * 60 * 1000,
}: UseFormDraftProps<TFieldValues>) {
	const [isRestored, setIsRestored] = useState(false);
	const onRestoredRef = useRef(onRestored);
	onRestoredRef.current = onRestored;

	// 1. Restore draft on mount
	useEffect(() => {
		async function restoreDraft() {
			let restored: Partial<TFieldValues> | null = null;
			try {
				const draft = await getIDB<Draft<TFieldValues>>(draftKey);
				if (draft && Date.now() - draft.timestamp > maxAgeMs) {
					await delIDB(draftKey);
				} else if (draft?.values) {
					reset(draft.values as DefaultValues<TFieldValues>, {
						keepDefaultValues: true,
					});
					restored = draft.values;
				}
			} catch (e) {
				console.error("Failed to restore draft", e);
			} finally {
				setIsRestored(true);
				onRestoredRef.current?.(restored);
			}
		}

		restoreDraft();
	}, [draftKey, reset, maxAgeMs]);

	// 2. Save values on change, once the restore is done so it can't be overwritten
	useEffect(() => {
		if (!isRestored) return;
		const subscription = watch((values) => {
			const draft: Draft<TFieldValues> = {
				values: values as Partial<TFieldValues>,
				timestamp: Date.now(),
			};
			setIDB(draftKey, draft).catch((e) =>
				console.error("Failed to save draft", e),
			);
		});
		return () => subscription.unsubscribe();
	}, [isRestored, watch, draftKey]);

	// 3. Clear draft helper
	const clearDraft = async () => {
		try {
			await delIDB(draftKey);
		} catch (e) {
			console.error("Failed to clear draft", e);
		}
	};

	return { isRestored, clearDraft };
}
