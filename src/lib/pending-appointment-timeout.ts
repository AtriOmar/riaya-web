import { pendingTimeoutQueue } from "@/lib/queue";

/** How long an AI pending request may sit unanswered before auto-cancel. */
export const PENDING_APPOINTMENT_TIMEOUT_MS = 10 * 60 * 1000;

/** How long one wave of urgent requests waits for a doctor before the next wave. */
export const EMERGENCY_WAVE_TIMEOUT_MS = 4 * 60 * 1000;

export function pendingTimeoutJobIdForAppointment(appointmentId: number) {
	return `pending-timeout:appt:${appointmentId}`;
}

type EmergencyWave = { emergencyGroupId: string; wave: number };

export function pendingTimeoutJobIdForEmergency({
	emergencyGroupId,
	wave,
}: EmergencyWave) {
	// BullMQ accepts ':' in a custom id only when it has exactly three parts.
	return `pending-timeout:emergency:${emergencyGroupId}-wave-${wave}`;
}

export async function schedulePendingAppointmentTimeout(params: {
	appointmentId: number;
	delayMs?: number;
}) {
	const jobId = pendingTimeoutJobIdForAppointment(params.appointmentId);
	await pendingTimeoutQueue.add(
		"pending-timeout",
		{ kind: "appointment" as const, appointmentId: params.appointmentId },
		{
			jobId,
			delay: params.delayMs ?? PENDING_APPOINTMENT_TIMEOUT_MS,
			removeOnComplete: true,
			removeOnFail: true,
		},
	);
}

/** When this wave of urgent requests runs out of time, move to the next wave. */
export async function scheduleEmergencyPendingTimeout(params: EmergencyWave) {
	await pendingTimeoutQueue.add(
		"pending-timeout",
		{
			kind: "emergency" as const,
			emergencyGroupId: params.emergencyGroupId,
			wave: params.wave,
		},
		{
			jobId: pendingTimeoutJobIdForEmergency(params),
			delay: EMERGENCY_WAVE_TIMEOUT_MS,
			removeOnComplete: true,
			removeOnFail: true,
		},
	);
}

/** Every doctor in this wave refused: move to the next wave now instead of waiting. */
export async function expediteEmergencyPendingTimeout(params: EmergencyWave) {
	try {
		const job = await pendingTimeoutQueue.getJob(
			pendingTimeoutJobIdForEmergency(params),
		);
		if (job && (await job.isDelayed())) await job.promote();
	} catch {
		/* already processed or missing */
	}
}

/**
 * Tell the patient (call, then WhatsApp fallback) that the doctor refused.
 * Handled by the same worker as the timeout; no delay.
 */
export async function scheduleRefusalNotification(params: {
	appointmentId: number;
}) {
	await pendingTimeoutQueue.add(
		"pending-timeout",
		{ kind: "refused" as const, appointmentId: params.appointmentId },
		{
			jobId: `refused:appt:${params.appointmentId}`,
			removeOnComplete: true,
			removeOnFail: true,
		},
	);
}

export async function cancelPendingAppointmentTimeoutJob(
	appointmentId: number,
) {
	try {
		const job = await pendingTimeoutQueue.getJob(
			pendingTimeoutJobIdForAppointment(appointmentId),
		);
		if (job) await job.remove();
	} catch {
		/* already processed or missing */
	}
}

export async function cancelEmergencyPendingTimeoutJob(params: EmergencyWave) {
	try {
		const job = await pendingTimeoutQueue.getJob(
			pendingTimeoutJobIdForEmergency(params),
		);
		if (job) await job.remove();
	} catch {
		/* already processed or missing */
	}
}
