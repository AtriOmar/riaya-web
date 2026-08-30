import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import {
	appointment,
	call,
	callEvent,
	cities,
	doctorApplication,
	doctorProfile,
	patient,
	patientMedicalFile,
	person,
	speciality,
	user,
} from "./schema";

export const selectSpecialitySchema = createSelectSchema(speciality);
export const selectCitiesSchema = createSelectSchema(cities);
export const selectDoctorProfileSchema = createSelectSchema(doctorProfile);
export const selectPersonSchema = createSelectSchema(person);
export const selectPatientSchema = createSelectSchema(patient);
export const selectPatientMedicalFileSchema =
	createSelectSchema(patientMedicalFile);
export const selectAppointmentSchema = createSelectSchema(appointment);
export const selectDoctorApplicationSchema =
	createSelectSchema(doctorApplication);
export const selectUserSchema = createSelectSchema(user);
export const selectDoctorApplicationWithRelationsSchema =
	selectDoctorApplicationSchema.merge(
		z.object({
			speciality: selectSpecialitySchema.nullable(),
			cabinetCity: selectCitiesSchema.nullable(),
			user: selectUserSchema
				.pick({ id: true, username: true, email: true })
				.nullable(),
		}),
	);
export const selectCallSchema = createSelectSchema(call);
export const selectCallEventSchema = createSelectSchema(callEvent);
export const selectCallWithEventsSchema = selectCallSchema.merge(
	z.object({
		events: z.array(selectCallEventSchema),
	}),
);

export const selectDoctorProfileWithRelationsSchema =
	selectDoctorProfileSchema.merge(
		z.object({
			speciality: selectSpecialitySchema.nullable(),
			cabinetCity: selectCitiesSchema.nullable(),
		}),
	);

export const selectUserWithDoctorProfileSchema = selectUserSchema.merge(
	z.object({
		hasDoctorProfile: z.boolean(),
		doctorProfile: selectDoctorProfileWithRelationsSchema.nullable(),
	}),
);

export const selectBestFitDoctorSchema = selectDoctorProfileSchema
	.omit({ availability: true })
	.merge(
		z.object({
			distance: z.number(),
			nextSlot: z.object({ start: z.string(), end: z.string() }),
		}),
	);

export const statsResponseSchema = z.object({
	total: z.number(),
	admins: z.number(),
	verified: z.number(),
	pending: z.number(),
	rejected: z.number(),
	banned: z.number(),
});

export const signedUrlResponseSchema = z.object({
	signedUrl: z.string(),
	key: z.string(),
	cdnUrl: z.string(),
});
