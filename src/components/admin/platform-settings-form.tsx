"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/error-handling";
import {
	EMERGENCY_FANOUT_RANGE,
	EMERGENCY_MAX_WAVES_RANGE,
	EMERGENCY_WAVE_TIMEOUT_RANGE,
	PENDING_TIMEOUT_RANGE,
} from "@/lib/platform-settings-schema";
import {
	useGetApiPlatformSettings,
	usePutApiPlatformSettings,
} from "@/services/generated/admin/admin";

type Range = { min: number; max: number };

function NumberField(props: {
	id: string;
	label: string;
	description: string;
	range: Range;
	unit: string;
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<div className="grid gap-2">
			<Label htmlFor={props.id}>{props.label}</Label>
			<div className="flex items-center gap-2">
				<Input
					id={props.id}
					type="number"
					inputMode="numeric"
					min={props.range.min}
					max={props.range.max}
					step={1}
					value={props.value}
					onChange={(e) => props.onChange(e.target.value)}
					className="w-24"
				/>
				<span className="text-muted-foreground text-sm">{props.unit}</span>
			</div>
			<p className="text-muted-foreground text-sm">{props.description}</p>
		</div>
	);
}

function isInRange(value: string, { min, max }: Range) {
	const n = Number(value);
	return value.trim() !== "" && Number.isInteger(n) && n >= min && n <= max;
}

export default function PlatformSettingsForm() {
	const { data, mutate, isLoading } = useGetApiPlatformSettings();
	const { trigger, isMutating } = usePutApiPlatformSettings();
	const [pending, setPending] = useState("");
	const [wave, setWave] = useState("");
	const [fanout, setFanout] = useState("");
	const [maxWaves, setMaxWaves] = useState("");

	useEffect(() => {
		if (!data) return;
		setPending(String(data.pendingTimeoutMinutes));
		setWave(String(data.emergencyWaveTimeoutMinutes));
		setFanout(String(data.emergencyFanoutCount));
		setMaxWaves(String(data.emergencyMaxWaves));
	}, [data]);

	if (isLoading || !data) return <Skeleton className="h-64 w-full" />;

	const valid =
		isInRange(pending, PENDING_TIMEOUT_RANGE) &&
		isInRange(wave, EMERGENCY_WAVE_TIMEOUT_RANGE) &&
		isInRange(fanout, EMERGENCY_FANOUT_RANGE) &&
		isInRange(maxWaves, EMERGENCY_MAX_WAVES_RANGE);
	const unchanged =
		Number(pending) === data.pendingTimeoutMinutes &&
		Number(wave) === data.emergencyWaveTimeoutMinutes &&
		Number(fanout) === data.emergencyFanoutCount &&
		Number(maxWaves) === data.emergencyMaxWaves;

	async function save() {
		try {
			const saved = await trigger({
				pendingTimeoutMinutes: Number(pending),
				emergencyWaveTimeoutMinutes: Number(wave),
				emergencyFanoutCount: Number(fanout),
				emergencyMaxWaves: Number(maxWaves),
			});
			await mutate(saved, { revalidate: false });
			toast.success("Settings saved");
		} catch (e) {
			toast.error(getErrorMessage(e));
		}
	}

	return (
		<div className="grid gap-6">
			<NumberField
				id="pending-timeout"
				label="Doctor response time"
				description="How long a doctor has to accept or refuse a phone booking before it is cancelled and the patient is contacted."
				range={PENDING_TIMEOUT_RANGE}
				unit="minutes"
				value={pending}
				onChange={setPending}
			/>
			<NumberField
				id="wave-timeout"
				label="Urgent request wave time"
				description="How long each group of doctors has to answer an urgent request before it goes to the next group."
				range={EMERGENCY_WAVE_TIMEOUT_RANGE}
				unit="minutes"
				value={wave}
				onChange={setWave}
			/>
			<NumberField
				id="fanout-count"
				label="Doctors per wave"
				description="How many doctors receive an urgent request at the same time."
				range={EMERGENCY_FANOUT_RANGE}
				unit="doctors"
				value={fanout}
				onChange={setFanout}
			/>
			<NumberField
				id="max-waves"
				label="Maximum waves"
				description="How many groups of doctors are tried before the patient is told nobody answered."
				range={EMERGENCY_MAX_WAVES_RANGE}
				unit="waves"
				value={maxWaves}
				onChange={setMaxWaves}
			/>
			<p className="text-muted-foreground text-sm">
				Changes apply to requests created after you save. Requests already
				waiting keep their current deadline.
			</p>
			<div>
				<Button onClick={save} disabled={!valid || unchanged || isMutating}>
					Save
				</Button>
			</div>
		</div>
	);
}
