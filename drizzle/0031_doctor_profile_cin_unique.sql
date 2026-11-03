DROP INDEX "doctor_profile_cin_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "doctor_profile_cin_idx" ON "doctor_profile" USING btree ("cin");