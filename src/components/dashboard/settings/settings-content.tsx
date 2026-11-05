"use client";

import { useAuth } from "@/components/contexts/auth-provider";
import { normalizeLanguage } from "@/lib/language";
import { useGetApiUsersMe } from "@/services/generated/users/users";
import NoteLanguage from "./note-language";

export default function SettingsContent() {
	const { user } = useAuth();
	const { data: me, mutate: mutateMe } = useGetApiUsersMe({
		swr: { enabled: !!user },
	});
	const profile = me?.doctorProfile;

	// Secretaries have no doctor profile, so nothing here is theirs to set
	if (!profile) return null;

	return (
		<NoteLanguage
			value={normalizeLanguage(profile.noteLanguage)}
			onSaved={() => void mutateMe()}
		/>
	);
}
