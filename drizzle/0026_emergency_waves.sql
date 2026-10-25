ALTER TABLE "appointment" ADD COLUMN "emergency_wave" integer;--> statement-breakpoint
UPDATE "appointment" SET "emergency_wave" = 1 WHERE "emergency_group_id" IS NOT NULL;