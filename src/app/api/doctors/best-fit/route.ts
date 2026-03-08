import { db } from "@/db";
import { appointment, doctorProfile, speciality } from "@/db/schema";
import { json, apiError, validationError } from "@/lib/api-utils";
import { eq, and, gte, lt } from "drizzle-orm";
import { z } from "zod";
import type { NextRequest } from "next/server";

// ─── GET /api/doctors/best-fit ────────────────────────────────────────────────
// Public endpoint — finds best-fit doctors based on speciality, location, and time

type AvailabilitySlot = { start: number; end: number };
type Availability = Record<number, AvailabilitySlot[]>;

const schema = z.object({
  speciality: z.string().min(1),
  long: z.coerce.number(),
  lat: z.coerce.number(),
  time: z.string().optional(),
});

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (angle: number) => (Math.PI / 180) * angle;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function findNextAvailableSlot(
  availability: Availability,
  appointments: { start: Date | null; end: Date | null }[],
  currentTime: Date,
  desiredTime: Date,
) {
  let dayOfWeek = desiredTime.getDay();
  dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const desiredMinutes = desiredTime.getHours() * 60 + desiredTime.getMinutes();

  const roundToNearest30 = (minutes: number) => Math.ceil(minutes / 30) * 30;

  const isSlotAvailable = (slotStart: Date, slotEnd: Date) =>
    !appointments.some((appt) => {
      const aStart = new Date(appt.start!);
      const aEnd = new Date(appt.end!);
      return (
        (slotStart > aStart && slotStart < aEnd) ||
        (slotEnd > aStart && slotEnd < aEnd) ||
        (slotStart <= aStart && slotEnd >= aEnd)
      );
    });

  let slotFromRight: { start: Date; end: Date } | null = null;
  let slotFromLeft: { start: Date; end: Date } | null = null;

  // Search forward
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const dayIndex = (dayOfWeek + dayOffset) % 7;
    const slots = availability[dayIndex] || [];

    for (const slot of slots) {
      let start = Math.max(
        slot.start,
        dayOffset === 0 ? roundToNearest30(desiredMinutes) : slot.start,
      );

      while (start + 30 <= slot.end) {
        const slotStart = new Date(
          desiredTime.getTime() + dayOffset * 24 * 60 * 60 * 1000,
        );
        slotStart.setHours(Math.floor(start / 60), start % 60, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);

        if (slotStart >= currentTime && isSlotAvailable(slotStart, slotEnd)) {
          slotFromRight = { start: slotStart, end: slotEnd };
          dayOffset = 7;
          break;
        }
        start += 30;
      }
    }
  }

  // Search backward
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const dayIndex = (dayOfWeek - dayOffset + 7) % 7;
    const slots = (availability[dayIndex] || []).slice().reverse();

    for (const slot of slots) {
      let start = Math.min(
        slot.end - 30,
        dayOffset === 0 ? roundToNearest30(desiredMinutes) - 30 : slot.end,
      );

      while (start >= slot.start) {
        const slotStart = new Date(
          desiredTime.getTime() - dayOffset * 24 * 60 * 60 * 1000,
        );
        slotStart.setHours(Math.floor(start / 60), start % 60, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);

        if (slotStart >= currentTime && isSlotAvailable(slotStart, slotEnd)) {
          slotFromLeft = { start: slotStart, end: slotEnd };
          dayOffset = 7;
          break;
        }
        start -= 30;
      }
    }
  }

  if (!slotFromLeft) return slotFromRight;
  if (!slotFromRight) return slotFromLeft;
  return slotFromLeft.start <= slotFromRight.start
    ? slotFromLeft
    : slotFromRight;
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = schema.safeParse(searchParams);

    if (!parsed.success) return validationError(parsed.error.issues);

    const {
      speciality: specialityName,
      long,
      lat,
      time: desiredTimeParam,
    } = parsed.data;

    const currentTime = new Date();
    let desiredTime: Date;

    if (desiredTimeParam) {
      desiredTime = new Date(desiredTimeParam);
      if (Number.isNaN(desiredTime.getTime()) || desiredTime < currentTime) {
        return apiError("INVALID_DESIRED_TIME");
      }
    } else {
      desiredTime = currentTime;
    }

    const nextWeek = new Date(desiredTime.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Find speciality (case-insensitive via ilike)
    const specialities = await db
      .select()
      .from(speciality)
      .where(eq(speciality.name, specialityName));

    // Fallback: try case-insensitive match
    const specialityData = specialities[0];
    if (!specialityData) return apiError("SPECIALITY_NOT_FOUND");

    // Fetch verified doctors with this speciality
    const doctors = await db
      .select()
      .from(doctorProfile)
      .where(
        and(
          eq(doctorProfile.status, "verified"),
          eq(doctorProfile.specialityId, specialityData.id),
        ),
      );

    const processedDoctors = (
      await Promise.all(
        doctors.map(async (doctor) => {
          if (!doctor.cabinetLatitude || !doctor.cabinetLongitude) return null;

          const distance = calculateDistance(
            lat,
            long,
            doctor.cabinetLatitude,
            doctor.cabinetLongitude,
          );

          const appointments = await db
            .select({
              start: appointment.start,
              end: appointment.end,
            })
            .from(appointment)
            .where(
              and(
                eq(appointment.doctorId, doctor.id),
                gte(appointment.start, currentTime),
                lt(appointment.start, nextWeek),
              ),
            );

          const availability = (doctor.availability as Availability) ?? {};
          const nextSlot = findNextAvailableSlot(
            availability,
            appointments,
            currentTime,
            desiredTime,
          );

          if (!nextSlot) return null;

          const { availability: _avail, ...rest } = doctor;
          return { ...rest, distance, nextSlot };
        }),
      )
    ).filter(Boolean);

    const weight = 10;
    processedDoctors.sort((a, b) => {
      const now = new Date();
      const timeDiffA =
        (new Date(a!.nextSlot.start).getTime() - now.getTime()) / (1000 * 60);
      const timeDiffB =
        (new Date(b!.nextSlot.start).getTime() - now.getTime()) / (1000 * 60);
      return (
        a!.distance + timeDiffA / weight - (b!.distance + timeDiffB / weight)
      );
    });

    return json(processedDoctors);
  } catch (e) {
    if (e instanceof Response) return e;
    return apiError("INTERNAL_ERROR");
  }
}
