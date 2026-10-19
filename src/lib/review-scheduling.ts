import { reviewQueue } from "@/lib/queue";

/** How long after the appointment ends the review request is sent. */
export const REVIEW_REQUEST_DELAY_MS = 2 * 60 * 60 * 1000;

export function reviewJobId(appointmentId: number) {
	return `review-${appointmentId}`;
}

/**
 * Queue the review request for an appointment, replacing any earlier job.
 * BullMQ ignores an add whose jobId exists (even a completed one), so the old
 * job is removed first: a reschedule then gets a fresh delay.
 */
export async function scheduleReviewRequest(appt: {
	id: number;
	end: Date | null;
	doctorId: number | null;
	patientId: number | null;
}) {
	if (!appt.end || appt.doctorId == null) return;

	const jobId = reviewJobId(appt.id);
	const previous = await reviewQueue.getJob(jobId);
	if (previous) {
		await previous.remove().catch(() => {
			// Active job: it is already sending, keep it.
		});
	}

	const delay = Math.max(
		0,
		appt.end.getTime() + REVIEW_REQUEST_DELAY_MS - Date.now(),
	);
	await reviewQueue.add(
		"sendReview",
		{
			appointmentId: appt.id,
			doctorId: appt.doctorId,
			patientId: appt.patientId,
		},
		{ delay, jobId },
	);
}
