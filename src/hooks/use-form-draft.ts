import { useEffect, useRef } from "react";
import type { UseFormReset, UseFormWatch } from "react-hook-form";
import { delIDB, getIDB, setIDB } from "@/lib/idb";

interface UseFormDraftProps<TFieldValues extends Record<string, any>> {
	draftKey: string;
	watch: UseFormWatch<TFieldValues>;
	reset: UseFormReset<TFieldValues>;
	files?: Record<string, File | null>;
	setFiles?: Record<string, (file: File | null) => void>;
	onRestored?: () => void;
	/** Maximum age of the draft in milliseconds. Defaults to 24 hours. */
	maxAgeMs?: number;
}

export function useFormDraft<TFieldValues extends Record<string, any>>({
	draftKey,
	watch,
	reset,
	files = {},
	setFiles = {},
	onRestored,
	maxAgeMs = 24 * 60 * 60 * 1000, // 24 hours
}: UseFormDraftProps<TFieldValues>) {
	const isRestored = useRef(false);

	// 1. Restore draft on mount
	useEffect(() => {
		async function restoreDraft() {
			try {
				const draft = await getIDB<{
					values: TFieldValues;
					files: Record<string, File | null>;
					timestamp?: number;
				}>(draftKey);

				if (draft) {
					// Check for expiration
					if (draft.timestamp && Date.now() - draft.timestamp > maxAgeMs) {
						await delIDB(draftKey);
						return; // Draft expired, do not restore
					}

					// Restore text values
					if (draft.values && Object.keys(draft.values).length > 0) {
						// Merge with default values so we don't wipe out defaults
						reset(draft.values, { keepDefaultValues: true });
					}
					// Restore files
					if (draft.files && setFiles) {
						for (const [key, file] of Object.entries(draft.files)) {
							if (setFiles[key] && file) {
								setFiles[key](file);
							}
						}
					}
				}
			} catch (e) {
				console.error("Failed to restore draft", e);
			} finally {
				isRestored.current = true;
				onRestored?.();
			}
		}

		restoreDraft();
	}, [draftKey, reset]); // eslint-disable-line react-hooks/exhaustive-deps

	// 2. Save text values on change
	useEffect(() => {
		const subscription = watch(async (value) => {
			if (!isRestored.current) return;
			try {
				const currentDraft = (await getIDB(draftKey)) || {
					values: {},
					files: {},
				};
				await setIDB(draftKey, {
					...currentDraft,
					values: value,
					timestamp: Date.now(),
				});
			} catch (e) {
				console.error("Failed to save draft values", e);
			}
		});
		return () => subscription.unsubscribe();
	}, [watch, draftKey]);

	// 3. Save files on change
	const fileNames = Object.values(files)
		.map((f) => f?.name)
		.join(",");

	useEffect(() => {
		if (!isRestored.current) return;
		const saveFiles = async () => {
			try {
				const currentDraft = (await getIDB(draftKey)) || {
					values: {},
					files: {},
				};
				await setIDB(draftKey, {
					...currentDraft,
					files: files, // Object references are saved into IDB directly (File objects are clonable)
					timestamp: Date.now(),
				});
			} catch (e) {
				console.error("Failed to save draft files", e);
			}
		};
		saveFiles();
	}, [draftKey, fileNames]); // eslint-disable-line react-hooks/exhaustive-deps

	// 4. Clear draft helper
	const clearDraft = async () => {
		try {
			await delIDB(draftKey);
		} catch (e) {
			console.error("Failed to clear draft", e);
		}
	};

	return { clearDraft };
}
