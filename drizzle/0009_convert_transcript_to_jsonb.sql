UPDATE "consultation_recording" SET "transcript" = NULL;--> statement-breakpoint
ALTER TABLE "consultation_recording" ALTER COLUMN "transcript" SET DATA TYPE jsonb USING "transcript"::jsonb;
