import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	appointment,
	doctorProfile,
	patient,
	person,
	review,
} from "@/db/schema";
import { personDisplayName } from "@/lib/person-name";

// Admin-only. Doctors never see their ratings.

/** Below this many reviews, a value is shown as too few to judge (still returned). */
export const REVIEW_SUMMARY_MIN_REVIEWS = 5;
/** Ratings at or below this count as a low rating. */
export const LOW_RATING_MAX = 2;
/** Highlighted on the admin Ratings page when the average is below this. */
export const POOR_AVERAGE_BELOW = 3;
const RECENT_WINDOW_DAYS = 90;
const MAX_DETAIL_REVIEWS = 100;

export const doctorRatingSorts = [
	"average_asc",
	"average_desc",
	"reviews_desc",
	"latest_low_desc",
] as const;
export type DoctorRatingSort = (typeof doctorRatingSorts)[number];

type StatsRow = {
	doctor_id: number;
	review_count: number;
	review_count_90d: number;
	wait_count: number;
	long_wait_count: number;
	/** UTC wall time as text: raw `pg` would read it as local time. */
	latest_low_rating_at: string | null;
	average: string | null;
	average_90d: string | null;
};

/**
 * Submitted-review stats per doctor. Each patient counts once in an average:
 * their ratings are averaged first, then those means are averaged. Reviews
 * without a patient are their own group. The 90-day window uses the
 * submission time (`updated_at`).
 */
async function ratingStats(doctorId?: number) {
	// Timestamps are stored as UTC wall time (no time zone), like drizzle writes them.
	const since = new Date(
		Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
	).toISOString();
	const doctorFilter =
		doctorId != null ? sql`and ${review.doctorId} = ${doctorId}` : sql``;

	const result = await db.execute<StatsRow>(sql`
		with submitted as (
			select * from ${review}
			where ${review.status} = 'submitted' ${doctorFilter}
		),
		per_patient as (
			select
				doctor_id,
				avg(rating) as rating,
				avg(rating) filter (where updated_at >= ${since}::timestamp) as rating_90d
			from submitted
			where rating is not null
			group by doctor_id, coalesce('p' || patient_id::text, 'r' || id::text)
		),
		averages as (
			select doctor_id, avg(rating) as average, avg(rating_90d) as average_90d
			from per_patient
			group by doctor_id
		),
		counts as (
			select
				doctor_id,
				count(*)::int as review_count,
				count(*) filter (where updated_at >= ${since}::timestamp)::int as review_count_90d,
				count(wait_time)::int as wait_count,
				count(*) filter (where wait_time = 'long')::int as long_wait_count,
				(max(updated_at) filter (where rating <= ${LOW_RATING_MAX}))::text as latest_low_rating_at
			from submitted
			group by doctor_id
		)
		select c.*, a.average, a.average_90d
		from counts c
		left join averages a using (doctor_id)
	`);

	return new Map(
		result.rows.map((r) => {
			return [
				r.doctor_id,
				{
					reviewCount: r.review_count,
					reviewCount90d: r.review_count_90d,
					averageRating: r.average != null ? Number(r.average) : null,
					last90DaysAverage:
						r.average_90d != null ? Number(r.average_90d) : null,
					waitCount: r.wait_count,
					longWaitCount: r.long_wait_count,
					latestLowRatingAt: r.latest_low_rating_at
						? new Date(
								`${r.latest_low_rating_at.replace(" ", "T")}Z`,
							).toISOString()
						: null,
				},
			];
		}),
	);
}

type RatingStats = NonNullable<
	ReturnType<Awaited<ReturnType<typeof ratingStats>>["get"]>
>;

const EMPTY_STATS: RatingStats = {
	reviewCount: 0,
	reviewCount90d: 0,
	averageRating: null,
	last90DaysAverage: null,
	waitCount: 0,
	longWaitCount: 0,
	latestLowRatingAt: null,
};

function exclusionOf(d: typeof doctorProfile.$inferSelect) {
	return d.bestFitExcludedAt
		? {
				excludedAt: d.bestFitExcludedAt.toISOString(),
				reason: d.bestFitExcludedReason ?? "",
			}
		: null;
}

function compareNullable(a: number | null, b: number | null, dir: 1 | -1) {
	if (a == null && b == null) return 0;
	if (a == null) return 1; // nulls last either way
	if (b == null) return -1;
	return (a - b) * dir;
}

/** Doctors with submitted reviews, plus any excluded doctor, sorted. */
export async function listDoctorRatings(sort: DoctorRatingSort) {
	const stats = await ratingStats();
	const doctors = await db.query.doctorProfile.findMany({
		where: (d, { inArray, isNotNull, or }) =>
			or(
				stats.size > 0 ? inArray(d.id, [...stats.keys()]) : undefined,
				isNotNull(d.bestFitExcludedAt),
			),
		with: { speciality: true, user: { columns: { image: true } } },
	});

	const rows = doctors.map((d) => ({
		doctorId: d.id,
		name: personDisplayName(d),
		firstName: d.firstName,
		lastName: d.lastName,
		image: d.user?.image ?? null,
		cabinetName: d.cabinetName,
		speciality: d.speciality?.enName ?? null,
		...(stats.get(d.id) ?? EMPTY_STATS),
		exclusion: exclusionOf(d),
	}));

	const time = (s: string | null) => (s ? new Date(s).getTime() : null);
	// Averages: judgeable doctors first, then too-few-reviews, then no reviews.
	const tier = (r: (typeof rows)[number]) =>
		r.averageRating == null
			? 2
			: r.reviewCount >= REVIEW_SUMMARY_MIN_REVIEWS
				? 0
				: 1;
	const byAverage = (
		a: (typeof rows)[number],
		b: (typeof rows)[number],
		dir: 1 | -1,
	) =>
		tier(a) - tier(b) || compareNullable(a.averageRating, b.averageRating, dir);

	rows.sort((a, b) => {
		switch (sort) {
			case "average_desc":
				return byAverage(a, b, -1);
			case "reviews_desc":
				return b.reviewCount - a.reviewCount;
			case "latest_low_desc":
				return compareNullable(
					time(a.latestLowRatingAt),
					time(b.latestLowRatingAt),
					-1,
				);
			default:
				return byAverage(a, b, 1);
		}
	});
	return rows;
}

/** One doctor's stats and submitted reviews, newest first. Null if no doctor. */
export async function getDoctorFeedback(doctorId: number) {
	const doctor = await db.query.doctorProfile.findFirst({
		where: eq(doctorProfile.id, doctorId),
		with: { speciality: true, user: { columns: { image: true } } },
	});
	if (!doctor) return null;

	const [stats, reviews] = await Promise.all([
		ratingStats(doctorId),
		db
			.select({
				id: review.id,
				appointmentId: review.appointmentId,
				rating: review.rating,
				waitTime: review.waitTime,
				comment: review.comment,
				submittedAt: review.updatedAt,
				appointmentDate: appointment.start,
				patientFirstName: patient.firstName,
				patientLastName: patient.lastName,
				personFirstName: person.firstName,
				personLastName: person.lastName,
			})
			.from(review)
			.innerJoin(appointment, eq(appointment.id, review.appointmentId))
			.leftJoin(patient, eq(patient.id, review.patientId))
			.leftJoin(person, eq(person.id, appointment.personId))
			.where(
				sql`${review.doctorId} = ${doctorId} and ${review.status} = 'submitted'`,
			)
			.orderBy(desc(review.updatedAt))
			.limit(MAX_DETAIL_REVIEWS),
	]);

	return {
		doctorId: doctor.id,
		name: personDisplayName(doctor),
		firstName: doctor.firstName,
		lastName: doctor.lastName,
		image: doctor.user?.image ?? null,
		cabinetName: doctor.cabinetName,
		speciality: doctor.speciality?.enName ?? null,
		...(stats.get(doctor.id) ?? EMPTY_STATS),
		exclusion: exclusionOf(doctor),
		reviews: reviews.map((r) => ({
			id: r.id,
			appointmentId: r.appointmentId,
			rating: r.rating,
			waitTime: r.waitTime,
			comment: r.comment?.trim() ? r.comment : null,
			submittedAt: r.submittedAt?.toISOString() ?? null,
			appointmentDate: r.appointmentDate?.toISOString() ?? null,
			patientName:
				personDisplayName({
					firstName: r.patientFirstName,
					lastName: r.patientLastName,
				}) ||
				personDisplayName({
					firstName: r.personFirstName,
					lastName: r.personLastName,
				}) ||
				null,
		})),
	};
}
