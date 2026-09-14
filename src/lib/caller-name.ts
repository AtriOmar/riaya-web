export function splitCallerName(name: string | null | undefined): {
	firstName: string;
	lastName: string;
} {
	const trimmed = name?.trim() || "";
	if (!trimmed) return { firstName: "Unknown", lastName: "Patient" };
	const parts = trimmed.split(/\s+/).filter(Boolean);
	if (parts.length === 1)
		return { firstName: parts[0] ?? "Unknown", lastName: "—" };
	return {
		firstName: parts[0] ?? "Unknown",
		lastName: parts.slice(1).join(" ") || "—",
	};
}
