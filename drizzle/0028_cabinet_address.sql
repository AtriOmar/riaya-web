ALTER TABLE "doctor_profile" RENAME COLUMN "address" TO "cabinet_address";--> statement-breakpoint
ALTER TABLE "doctor_application" ADD COLUMN "cabinet_address" text;
