"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	type CallSettings,
	callSettingsSchema,
} from "@/lib/call-settings-schema";
import {
	CALLER_STT_OPTIONS,
	LLM_OPTIONS,
	type ModelOption,
	type Rating,
	REALTIME_OPTIONS,
	STT_OPTIONS,
	TTS_OPTIONS,
} from "@/lib/test-call-models";
import { cn } from "@/lib/utils";

type SlotKey = "stt" | "llm" | "tts" | "realtime" | "callerStt";
type Engine = "stream" | "livekit";

type CustomState = {
	provider: string;
	model: string;
	voice: string;
	reasoning: "none" | "minimal";
};
type Choice = { id: string; custom: CustomState };
type PanelState = Record<SlotKey, Choice>;

type SlotDef = {
	key: SlotKey;
	label: string;
	options: ModelOption<unknown>[];
	providers: { value: string; label: string }[];
	hasVoice: boolean;
	hasReasoning: boolean;
};

const SLOTS: Record<SlotKey, SlotDef> = {
	stt: {
		key: "stt",
		label: "Speech-to-text",
		options: STT_OPTIONS,
		providers: [
			{ value: "openrouter-chat", label: "OpenRouter chat (audio in)" },
			{ value: "openrouter-transcription", label: "OpenRouter transcription" },
			{ value: "google", label: "Google API" },
			{ value: "openai", label: "OpenAI (streaming)" },
			{ value: "livekit-inference", label: "LiveKit Inference" },
			{ value: "inworld", label: "Inworld" },
		],
		hasVoice: false,
		hasReasoning: true,
	},
	llm: {
		key: "llm",
		label: "LLM",
		options: LLM_OPTIONS,
		providers: [
			{ value: "openrouter", label: "OpenRouter" },
			{ value: "google", label: "Google API" },
			{ value: "livekit-inference", label: "LiveKit Inference" },
		],
		hasVoice: false,
		hasReasoning: false,
	},
	tts: {
		key: "tts",
		label: "Text-to-speech",
		options: TTS_OPTIONS,
		providers: [
			{ value: "gemini-google", label: "Gemini on Google API" },
			{ value: "gemini-openrouter", label: "Gemini on OpenRouter" },
			{ value: "openrouter", label: "OpenRouter (any speech model)" },
			{ value: "openai", label: "OpenAI" },
			{ value: "inworld", label: "Inworld" },
			{ value: "inference", label: "LiveKit Inference" },
		],
		hasVoice: true,
		hasReasoning: false,
	},
	realtime: {
		key: "realtime",
		label: "Realtime model",
		options: REALTIME_OPTIONS,
		providers: [
			{ value: "gemini", label: "Gemini Live" },
			{ value: "openai", label: "OpenAI Realtime" },
			{ value: "gpt-live", label: "GPT-Live" },
		],
		hasVoice: true,
		hasReasoning: false,
	},
	callerStt: {
		key: "callerStt",
		label: "Caller transcript",
		options: CALLER_STT_OPTIONS,
		providers: [
			{ value: "openrouter-chat", label: "OpenRouter chat (audio in)" },
			{ value: "openrouter-transcription", label: "OpenRouter transcription" },
			{ value: "off", label: "Off (realtime model's transcript)" },
		],
		hasVoice: false,
		hasReasoning: true,
	},
};

const ENGINE_SLOTS: Record<Engine, SlotKey[]> = {
	livekit: ["stt", "llm", "tts"],
	stream: ["realtime", "callerStt"],
};

const STORAGE_KEY = "riaya:test-call-models";

function emptyChoice(slot: SlotDef): Choice {
	return {
		id: "default",
		custom: {
			provider: slot.providers[0].value,
			model: "",
			voice: "",
			reasoning: "minimal",
		},
	};
}

function initialState(): PanelState {
	return {
		stt: emptyChoice(SLOTS.stt),
		llm: emptyChoice(SLOTS.llm),
		tts: emptyChoice(SLOTS.tts),
		realtime: emptyChoice(SLOTS.realtime),
		callerStt: emptyChoice(SLOTS.callerStt),
	};
}

function customValue(key: SlotKey, c: CustomState): unknown {
	const model = c.model.trim();
	const voice = c.voice.trim() || undefined;
	if (key === "callerStt" && c.provider === "off") return { api: "off" };
	if (!model) return undefined;
	switch (key) {
		case "stt":
			return { api: c.provider, model, reasoning: c.reasoning };
		case "llm":
			return { provider: c.provider, model };
		case "tts":
			return { provider: c.provider, model, voice };
		case "realtime":
			return { backend: c.provider, model, voice };
		case "callerStt":
			return { api: c.provider, model, reasoning: c.reasoning };
	}
}

function slotValue(key: SlotKey, choice: Choice): unknown {
	if (choice.id === "default") return undefined;
	if (choice.id === "custom") return customValue(key, choice.custom);
	return SLOTS[key].options.find((o) => o.id === choice.id)?.value;
}

function buildSettings(
	engine: Engine,
	state: PanelState,
): CallSettings | undefined {
	const draft: Record<string, Record<string, unknown>> = {};
	if (engine === "livekit") {
		const pipeline: Record<string, unknown> = {};
		for (const key of ENGINE_SLOTS.livekit) {
			const v = slotValue(key, state[key]);
			if (v !== undefined) pipeline[key] = v;
		}
		if (Object.keys(pipeline).length > 0) draft.pipeline = pipeline;
	} else {
		const phone: Record<string, unknown> = {};
		for (const key of ENGINE_SLOTS.stream) {
			const v = slotValue(key, state[key]);
			if (v !== undefined) phone[key] = v;
		}
		if (Object.keys(phone).length > 0) draft.phone = phone;
	}
	if (Object.keys(draft).length === 0) return undefined;
	const parsed = callSettingsSchema.safeParse(draft);
	return parsed.success ? parsed.data : undefined;
}

// ─── UI ──────────────────────────────────────────────────────────────────────

type PickerItem = {
	id: string;
	label: string;
	rating: Rating | "default" | "custom";
	price: string;
	speed?: string;
	note: string;
};

const RATING_STYLE: Record<PickerItem["rating"], string> = {
	recommended:
		"border-green-600/40 bg-green-500/10 text-green-700 dark:text-green-400",
	good: "border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
	ok: "border-amber-600/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
	bad: "border-red-600/40 bg-red-500/10 text-red-700 dark:text-red-400",
	untested: "text-muted-foreground",
	default: "text-muted-foreground",
	custom: "text-muted-foreground",
};

function RatingBadge({ rating }: { rating: PickerItem["rating"] }) {
	const text =
		rating === "default"
			? "server default"
			: rating === "custom"
				? "custom"
				: rating;
	return (
		<Badge
			variant="outline"
			className={cn("shrink-0 px-1.5 py-0 text-[10px]", RATING_STYLE[rating])}
		>
			{text}
		</Badge>
	);
}

function itemsFor(slot: SlotDef): PickerItem[] {
	return [
		{
			id: "default",
			label: "Server default (.env)",
			rating: "default",
			price: "",
			note: "Use whatever the server is configured with.",
		},
		...slot.options.map((o) => ({
			id: o.id,
			label: o.label,
			rating: o.rating,
			price: o.price,
			speed: o.speed,
			note: o.note,
		})),
		{
			id: "custom",
			label: "Custom model ID…",
			rating: "custom",
			price: "",
			note: "Type any provider and model ID. Unrated, price unknown.",
		},
	];
}

function SlotPicker({
	slot,
	choice,
	disabled,
	onChange,
}: {
	slot: SlotDef;
	choice: Choice;
	disabled: boolean;
	onChange: (next: Choice) => void;
}) {
	const items = itemsFor(slot);
	const selected = items.find((i) => i.id === choice.id) ?? items[0];
	const setCustom = (patch: Partial<CustomState>) =>
		onChange({ ...choice, custom: { ...choice.custom, ...patch } });
	const customNeedsModel = !(
		slot.key === "callerStt" && choice.custom.provider === "off"
	);

	return (
		<div className="space-y-1.5">
			<Label className="text-xs">{slot.label}</Label>
			<Combobox
				items={items}
				value={selected}
				disabled={disabled}
				onValueChange={(v) => v && onChange({ ...choice, id: v.id })}
				isItemEqualToValue={(a, b) => a.id === b.id}
				filter={(item, query) =>
					`${(item as PickerItem).label} ${(item as PickerItem).note}`
						.toLowerCase()
						.includes(query.trim().toLowerCase())
				}
			>
				<ComboboxInput placeholder="Pick a model…" className="w-full" />
				<ComboboxContent>
					<ComboboxList>
						{(item: PickerItem) => (
							<ComboboxItem key={item.id} value={item}>
								<div className="flex min-w-0 flex-col gap-0.5">
									<div className="flex items-center gap-2">
										<span className="truncate">{item.label}</span>
										<RatingBadge rating={item.rating} />
									</div>
									{(item.price || item.speed) && (
										<span className="text-muted-foreground text-xs">
											{[item.price, item.speed].filter(Boolean).join(" · ")}
										</span>
									)}
								</div>
							</ComboboxItem>
						)}
					</ComboboxList>
					<ComboboxEmpty>No model matches.</ComboboxEmpty>
				</ComboboxContent>
			</Combobox>

			{choice.id === "custom" ? (
				<div className="space-y-2 rounded-lg border p-2">
					<Select
						value={choice.custom.provider}
						onValueChange={(v) => v && setCustom({ provider: v })}
						disabled={disabled}
					>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="Provider" />
						</SelectTrigger>
						<SelectContent>
							{slot.providers.map((p) => (
								<SelectItem key={p.value} value={p.value}>
									{p.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{customNeedsModel && (
						<Input
							value={choice.custom.model}
							onChange={(e) => setCustom({ model: e.target.value })}
							placeholder="Model ID, e.g. google/gemini-2.5-flash"
							disabled={disabled}
						/>
					)}
					{slot.hasVoice && (
						<Input
							value={choice.custom.voice}
							onChange={(e) => setCustom({ voice: e.target.value })}
							placeholder="Voice (optional)"
							disabled={disabled}
						/>
					)}
					{slot.hasReasoning && customNeedsModel && (
						<Select
							value={choice.custom.reasoning}
							onValueChange={(v) =>
								v && setCustom({ reasoning: v as CustomState["reasoning"] })
							}
							disabled={disabled}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Reasoning" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="minimal">Reasoning: minimal</SelectItem>
								<SelectItem value="none">
									Reasoning: off (MiMo, 2.5 Flash)
								</SelectItem>
							</SelectContent>
						</Select>
					)}
					<p className="text-muted-foreground text-xs">
						Custom: unrated, price unknown.
						{slot.hasReasoning
							? " Some models reject or ignore the reasoning setting."
							: ""}
					</p>
				</div>
			) : (
				<p className="text-muted-foreground text-xs">
					{selected.note}
					{selected.price ? ` ${selected.price}.` : ""}
					{selected.speed ? ` Speed: ${selected.speed}.` : ""}
				</p>
			)}
		</div>
	);
}

export default function ModelSettingsPanel({
	engine,
	disabled,
	onChange,
	className,
}: {
	engine: Engine;
	disabled: boolean;
	onChange: (settings: CallSettings | undefined) => void;
	className?: string;
}) {
	const [state, setState] = useState<PanelState>(initialState);

	useEffect(() => {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) setState({ ...initialState(), ...JSON.parse(raw) });
		} catch {
			// private mode / corrupt value: keep defaults
		}
	}, []);

	useEffect(() => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
		} catch {
			// quota / private mode
		}
	}, [state]);

	useEffect(() => {
		onChange(buildSettings(engine, state));
	}, [engine, state, onChange]);

	const slots = ENGINE_SLOTS[engine];
	const customised = slots.filter((k) => state[k].id !== "default").length;

	return (
		<div
			className={cn(
				"overflow-hidden rounded-2xl border bg-card shadow-lg",
				className,
			)}
		>
			<div className="border-b bg-muted/40 px-5 py-4">
				<p className="font-semibold text-sm">Models</p>
				<p className="text-muted-foreground text-xs">
					{engine === "livekit" ? "LiveKit agent" : "Phone stream"} ·{" "}
					{customised > 0 ? `${customised} changed` : "server defaults"}
				</p>
			</div>
			<div className="space-y-4 p-4">
				{slots.map((key) => (
					<SlotPicker
						key={key}
						slot={SLOTS[key]}
						choice={state[key]}
						disabled={disabled}
						onChange={(next) => setState((s) => ({ ...s, [key]: next }))}
					/>
				))}
				<p className="text-muted-foreground text-xs">
					Any combination is allowed; the badges are hints. Real phone calls
					always use the server's .env.
				</p>
			</div>
		</div>
	);
}
