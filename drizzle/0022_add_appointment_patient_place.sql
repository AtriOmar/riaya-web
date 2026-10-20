ALTER TABLE "appointment" ADD COLUMN "patient_place_label" varchar(255);--> statement-breakpoint
ALTER TABLE "appointment" ADD COLUMN "patient_latitude" double precision;--> statement-breakpoint
ALTER TABLE "appointment" ADD COLUMN "patient_longitude" double precision;