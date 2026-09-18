/**
 * Speaker labels from OpenRouter/Azure diarization are 0-based indexes.
 * Missing values stay as a generic "Speaker".
 */
export function formatSpeakerLabel(speaker: unknown): string {
	if (speaker === null || speaker === undefined || speaker === "") {
		return "Speaker";
	}
	if (typeof speaker === "number" && Number.isFinite(speaker)) {
		return `Speaker ${speaker + 1}`;
	}
	const text = String(speaker).trim();
	if (/^\d+$/.test(text)) {
		return `Speaker ${Number(text) + 1}`;
	}
	return text;
}

export function formatTranscriptTimestamp(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
	const total = Math.floor(seconds);
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m}:${s.toString().padStart(2, "0")}`;
}

export type TranscriptFormatMeta = {
	title?: string | null;
	recordedAt?: string | Date | null;
	patientName?: string | null;
};

type RawSegment = {
	start?: number;
	end?: number;
	text?: string;
	speaker?: unknown;
	words?: { word?: string }[];
};

function segmentText(segment: RawSegment): string {
	if (segment.text?.trim()) return segment.text.trim();
	return (
		segment.words
			?.map((w) => w.word ?? "")
			.join(" ")
			.trim() ?? ""
	);
}

function parseTranscriptPayload(
	transcript: unknown,
):
	| { kind: "segments"; segments: RawSegment[] }
	| { kind: "plain"; text: string }
	| null {
	if (transcript === null || transcript === undefined) return null;

	if (typeof transcript === "string") {
		const trimmed = transcript.trim();
		if (!trimmed) return null;
		if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
			try {
				return parseTranscriptPayload(JSON.parse(trimmed));
			} catch {
				return { kind: "plain", text: trimmed };
			}
		}
		return { kind: "plain", text: trimmed };
	}

	if (typeof transcript === "object") {
		const obj = transcript as Record<string, unknown>;
		if (Array.isArray(obj.segments) && obj.segments.length > 0) {
			return { kind: "segments", segments: obj.segments as RawSegment[] };
		}
		if (typeof obj.text === "string" && obj.text.trim()) {
			return { kind: "plain", text: obj.text.trim() };
		}
	}

	return { kind: "plain", text: JSON.stringify(transcript, null, 2) };
}

/**
 * Markdown transcript for AI chat context (speaker + timestamp per turn).
 */
export function formatTranscriptForAiContext(
	transcript: unknown,
	meta?: TranscriptFormatMeta,
): string {
	const parsed = parseTranscriptPayload(transcript);
	if (!parsed) return "";

	const lines: string[] = ["# Consultation transcript", ""];

	if (meta?.title?.trim()) {
		lines.push(`**Recording:** ${meta.title.trim()}`);
	}
	if (meta?.patientName?.trim()) {
		lines.push(`**Patient:** ${meta.patientName.trim()}`);
	}
	if (meta?.recordedAt) {
		const date = new Date(meta.recordedAt);
		if (!Number.isNaN(date.getTime())) {
			lines.push(
				`**Recorded:** ${date.toLocaleDateString("en-GB", {
					day: "numeric",
					month: "long",
					year: "numeric",
				})}`,
			);
		}
	}

	if (lines.length > 2) {
		lines.push("", "---", "");
	} else {
		lines.pop();
		lines.push("", "---", "");
	}

	if (parsed.kind === "segments") {
		for (const segment of parsed.segments) {
			const text = segmentText(segment);
			if (!text) continue;
			const speaker = formatSpeakerLabel(segment.speaker);
			const time = formatTranscriptTimestamp(Number(segment.start ?? 0));
			lines.push(`## ${speaker} · ${time}`, "", text, "");
		}
		return lines.join("\n").trim();
	}

	lines.push(parsed.text);
	return lines.join("\n").trim();
}

export function transcriptContextFromRecording(recording: {
	id: number;
	title?: string | null;
	createdAt?: string | null;
	transcript: unknown;
	patient?: {
		firstName?: string | null;
		lastName?: string | null;
	} | null;
}): { recordingId: number; title: string; text: string } {
	const patientName =
		recording.patient?.firstName || recording.patient?.lastName
			? `${recording.patient.firstName ?? ""} ${recording.patient.lastName ?? ""}`.trim()
			: null;

	return {
		recordingId: recording.id,
		title: recording.title ?? "Untitled",
		text: formatTranscriptForAiContext(recording.transcript, {
			title: recording.title,
			recordedAt: recording.createdAt,
			patientName,
		}),
	};
}
