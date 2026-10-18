import {
	and,
	asc,
	count,
	eq,
	gte,
	inArray,
	lt,
	ne,
	sql,
	sum,
} from "drizzle-orm";
import { db } from "@/db";
import { appointment, invoice, invoicePayment, patient } from "@/db/schema";
import { personDisplayName } from "@/lib/person-name";
import { getPlanUsage } from "@/lib/plan-limits";

function startOfLocalDay(d = new Date()) {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number) {
	const next = new Date(d);
	next.setDate(next.getDate() + days);
	return next;
}

function toDateKey(d: Date) {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

/**
 * The doctor dashboard's numbers, charts and upcoming appointments. Shared by
 * `GET /api/dashboard/stats` and the AI assistant's `get_practice_stats` tool.
 */
export async function getDoctorDashboardStats(doctorId: number) {
	const now = new Date();
	const todayStart = startOfLocalDay(now);
	const tomorrowStart = addDays(todayStart, 1);
	const weekEnd = addDays(todayStart, 7);
	const chartStart = addDays(todayStart, -13);
	const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

	const doctorAppt = eq(appointment.doctorId, doctorId);
	const notCancelled = ne(appointment.status, "cancelled");

	const [
		plan,
		[patientsRow],
		[todayRow],
		[weekRow],
		[upcomingRow],
		[pendingRow],
		[unpaidRow],
		[collectedRow],
		[outstandingRow],
		dayRows,
		statusRows,
		sourceRows,
		upcomingRows,
	] = await Promise.all([
		getPlanUsage(doctorId),
		db
			.select({ count: count() })
			.from(patient)
			.where(eq(patient.doctorId, doctorId)),
		db
			.select({ count: count() })
			.from(appointment)
			.where(
				and(
					doctorAppt,
					notCancelled,
					gte(appointment.start, todayStart),
					lt(appointment.start, tomorrowStart),
				),
			),
		db
			.select({ count: count() })
			.from(appointment)
			.where(
				and(
					doctorAppt,
					notCancelled,
					gte(appointment.start, todayStart),
					lt(appointment.start, weekEnd),
				),
			),
		db
			.select({ count: count() })
			.from(appointment)
			.where(and(doctorAppt, notCancelled, gte(appointment.start, now))),
		db
			.select({ count: count() })
			.from(appointment)
			.where(and(doctorAppt, eq(appointment.status, "pending"))),
		db
			.select({ count: count() })
			.from(invoice)
			.where(
				and(
					eq(invoice.doctorId, doctorId),
					inArray(invoice.status, ["unpaid", "partially_paid"]),
				),
			),
		db
			.select({
				total: sum(invoicePayment.amountCentimes).mapWith(Number),
			})
			.from(invoicePayment)
			.innerJoin(invoice, eq(invoicePayment.invoiceId, invoice.id))
			.where(
				and(
					eq(invoice.doctorId, doctorId),
					gte(invoicePayment.paidAt, monthStart),
				),
			),
		db
			.select({
				total: sql<number>`coalesce(sum(${invoice.totalCentimes} - ${invoice.amountPaidCentimes}), 0)::int`,
			})
			.from(invoice)
			.where(
				and(
					eq(invoice.doctorId, doctorId),
					inArray(invoice.status, ["unpaid", "partially_paid"]),
				),
			),
		db
			.select({
				date: sql<string>`to_char(date_trunc('day', ${appointment.start}), 'YYYY-MM-DD')`,
				source: appointment.source,
				count: count(),
			})
			.from(appointment)
			.where(
				and(
					doctorAppt,
					notCancelled,
					gte(appointment.start, chartStart),
					lt(appointment.start, tomorrowStart),
				),
			)
			.groupBy(
				sql`date_trunc('day', ${appointment.start})`,
				appointment.source,
			),
		db
			.select({
				status: sql<string>`coalesce(${appointment.status}, 'unknown')`,
				count: count(),
			})
			.from(appointment)
			.where(doctorAppt)
			.groupBy(appointment.status),
		db
			.select({
				source: appointment.source,
				count: count(),
			})
			.from(appointment)
			.where(doctorAppt)
			.groupBy(appointment.source),
		db.query.appointment.findMany({
			where: and(doctorAppt, notCancelled, gte(appointment.start, now)),
			with: { patient: true, person: true },
			orderBy: [asc(appointment.start)],
			limit: 6,
		}),
	]);

	const byDayMap = new Map<
		string,
		{ date: string; total: number; ai: number; dashboard: number }
	>();
	for (let i = 0; i < 14; i++) {
		const key = toDateKey(addDays(chartStart, i));
		byDayMap.set(key, { date: key, total: 0, ai: 0, dashboard: 0 });
	}
	for (const row of dayRows) {
		const entry = byDayMap.get(row.date);
		if (!entry) continue;
		const n = Number(row.count);
		entry.total += n;
		if (row.source === "ai") entry.ai += n;
		else entry.dashboard += n;
	}

	return {
		counts: {
			patients: patientsRow?.count ?? 0,
			appointmentsToday: todayRow?.count ?? 0,
			appointmentsThisWeek: weekRow?.count ?? 0,
			upcomingAppointments: upcomingRow?.count ?? 0,
			pendingAppointments: pendingRow?.count ?? 0,
			unpaidInvoices: unpaidRow?.count ?? 0,
		},
		revenue: {
			collectedThisMonth: collectedRow?.total ?? 0,
			outstanding: outstandingRow?.total ?? 0,
		},
		plan,
		charts: {
			appointmentsByDay: [...byDayMap.values()],
			appointmentsByStatus: statusRows.map((r) => ({
				status: r.status,
				count: Number(r.count),
			})),
			appointmentsBySource: sourceRows.map((r) => ({
				source: r.source,
				count: Number(r.count),
			})),
		},
		upcoming: upcomingRows.map((a) => {
			const patientName =
				personDisplayName(a.patient) || personDisplayName(a.person);
			return {
				id: a.id,
				start: a.start?.toISOString() ?? null,
				end: a.end?.toISOString() ?? null,
				status: a.status,
				source: a.source,
				name: a.name,
				patientName: patientName || "—",
			};
		}),
	};
}
