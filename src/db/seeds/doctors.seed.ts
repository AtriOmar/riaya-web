import { eq } from "drizzle-orm";
import { auth } from "../../lib/auth";
import { user } from "../auth-schema";
import { db } from "../index";
import {
	cities,
	doctorApplication,
	doctorProfile,
	speciality,
} from "../schema";
import { DOCTORS } from "./doctors";

type DoctorSeed = {
	firstName: string | null;
	lastName: string | null;
	gender: string | null;
	specialitySlug: string | null;
	cabinetName: string | null;
	address: string | null;
	postalCode: number | null;
	phone: string | null;
	mobile: string | null;
	email: string | null;
	cin: string | null;
	tin: string | null;
	citySlug: string | null;
};

function normalizeSlug(value: string | null) {
	return value?.trim().toLowerCase() ?? "";
}

function buildFallbackEmail(index: number, doctor: DoctorSeed) {
	const base = `${doctor.firstName ?? ""}.${doctor.lastName ?? ""}`
		.toLowerCase()
		.replace(/[^a-z0-9.]+/g, ".")
		.replace(/\.{2,}/g, ".")
		.replace(/^\.|\.$/g, "");
	const safeBase = base.length > 0 ? base : `doctor-${index + 1}`;
	return `${safeBase}.${index + 1}@gmail.com`;
}

function buildSeedPassword(_index: number) {
	return `Password01`;
}

function buildUsername(index: number, doctor: DoctorSeed) {
	const first = (doctor.firstName ?? "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "");
	const last = (doctor.lastName ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
	const base = `${first}${last}`.trim();
	return `${base.length > 0 ? base : "doctor"}_${index + 1}`;
}

async function resolveOrCreateDoctorUser(
	index: number,
	doctor: DoctorSeed,
	email: string,
	name: string,
) {
	const existingByEmail = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.email, email))
		.limit(1);

	if (existingByEmail[0]?.id) {
		return existingByEmail[0].id;
	}

	const result = await auth.api.signUpEmail({
		body: {
			name,
			email,
			password: buildSeedPassword(index),
			username: buildUsername(index, doctor),
		},
	});

	return result.user.id;
}

function loadDoctorsData() {
	return DOCTORS as DoctorSeed[];
}

export async function seedDoctors() {
	const [cityRefs, specialityRefs] = await Promise.all([
		db
			.select({
				id: cities.id,
				slug: cities.slug,
				latitude: cities.latitude,
				longitude: cities.longitude,
			})
			.from(cities),
		db
			.select({
				id: speciality.id,
				slug: speciality.slug,
			})
			.from(speciality),
	]);

	const cityIdBySlug = new Map(
		cityRefs
			.filter((c) => c.slug)
			.map((c) => [normalizeSlug(c.slug), c.id] as const),
	);
	const cityBySlug = new Map(
		cityRefs
			.filter((c) => c.slug)
			.map((c) => [normalizeSlug(c.slug), c] as const),
	);
	const specialityIdBySlug = new Map(
		specialityRefs
			.filter((s) => s.slug)
			.map((s) => [normalizeSlug(s.slug), s.id] as const),
	);

	const doctors = loadDoctorsData();
	const validDoctors: Array<{
		raw: DoctorSeed;
		index: number;
		cityId: number;
		specialityId: number;
	}> = [];

	for (let index = 0; index < doctors.length; index++) {
		const raw = doctors[index];
		const cityId = cityIdBySlug.get(normalizeSlug(raw.citySlug));
		const specialityId = specialityIdBySlug.get(
			normalizeSlug(raw.specialitySlug),
		);

		if (!cityId || !specialityId) {
			continue;
		}

		validDoctors.push({ raw, index, cityId, specialityId });
	}

	if (validDoctors.length === 0) {
		return {
			insertedUsers: 0,
			insertedProfiles: 0,
			insertedApplications: 0,
			skippedDoctors: doctors.length,
		};
	}

	let insertedProfiles = 0;
	let insertedApplications = 0;

	for (const { raw, index, cityId, specialityId } of validDoctors) {
		const city = cityBySlug.get(normalizeSlug(raw.citySlug));
		const firstName = raw.firstName?.trim() ?? "";
		const lastName = raw.lastName?.trim() ?? "";
		const fullName = `${firstName} ${lastName}`.trim() || `Doctor ${index + 1}`;
		const email = raw.email?.trim() || buildFallbackEmail(index, raw);
		const userId = await resolveOrCreateDoctorUser(index, raw, email, fullName);

		await db
			.update(user)
			.set({
				name: fullName,
				emailVerified: true,
				displayName: fullName,
				accessId: 1,
				active: 2,
				type: raw.gender === "M" ? 1 : 2,
			})
			.where(eq(user.id, userId));

		const doctorValue = {
			userId,
			firstName,
			lastName,
			tin: raw.tin?.trim() ?? null,
			status: "verified" as const,
			cabinetName: raw.cabinetName?.trim() ?? null,
			cabinetCityId: cityId,
			cabinetLongitude: city?.longitude ?? null,
			cabinetLatitude: city?.latitude ?? null,
			specialityId,
		};

		await db
			.insert(doctorProfile)
			.values(doctorValue)
			.onConflictDoNothing({ target: doctorProfile.userId });
		insertedProfiles++;

		const existingApplication = await db
			.select({ userId: doctorApplication.userId })
			.from(doctorApplication)
			.where(eq(doctorApplication.userId, userId))
			.limit(1);

		if (existingApplication.length === 0) {
			await db.insert(doctorApplication).values({
				userId,
				firstName,
				lastName,
				cabinetName: raw.cabinetName?.trim() ?? null,
				cabinetCityId: cityId,
				cabinetLongitude: city?.longitude ?? null,
				cabinetLatitude: city?.latitude ?? null,
				status: "verified",
				tin: raw.tin?.trim() ?? null,
				specialityId,
			});
			insertedApplications++;
		}
	}

	return {
		insertedUsers: validDoctors.length,
		insertedProfiles,
		insertedApplications,
		skippedDoctors: doctors.length - validDoctors.length,
	};
}
