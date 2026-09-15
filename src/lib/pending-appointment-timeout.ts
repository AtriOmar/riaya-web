import { pendingTimeoutQueue } from "@/lib/queue";

/** How long an AI pending request may sit unanswered before auto-cancel. */
export const PENDING_APPOINTMENT_TIMEOUT_MS = 10 * 60 * 1000;

export function pendingTimeoutJobIdForAppointment(appointmentId: number) {
	return `pending-timeout:appt:${appointmentId}`;
}

export function pendingTimeoutJobIdForEmergency(emergencyGroupId: string) {
	return `pending-timeout:emergency:${emergencyGroupId}`;
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

export async function scheduleEmergencyPendingTimeout(params: {
	emergencyGroupId: string;
	delayMs?: number;
}) {
	const jobId = pendingTimeoutJobIdForEmergency(params.emergencyGroupId);
	await pendingTimeoutQueue.add(
		"pending-timeout",
		{
			kind: "emergency" as const,
			emergencyGroupId: params.emergencyGroupId,
		},
		{
			jobId,
			delay: params.delayMs ?? PENDING_APPOINTMENT_TIMEOUT_MS,
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

export async function cancelEmergencyPendingTimeoutJob(
	emergencyGroupId: string,
) {
	try {
		const job = await pendingTimeoutQueue.getJob(
			pendingTimeoutJobIdForEmergency(emergencyGroupId),
		);
		if (job) await job.remove();
	} catch {
		/* already processed or missing */
	}
}
