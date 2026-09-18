UPDATE "consultation_recording" SET "transcript" = NULL;--> statement-breakpoint
ALTER TABLE "consultation_recording" ALTER COLUMN "transcript" SET DATA TYPE jsonb USING "transcript"::jsonb;--> statement-breakpoint
ALTER TABLE "appointment" ADD COLUMN "urgent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "appointment" ADD COLUMN "emergency_group_id" varchar(64);--> statement-breakpoint
CREATE INDEX "appointment_emergency_group_id_idx" ON "appointment" USING btree ("emergency_group_id");