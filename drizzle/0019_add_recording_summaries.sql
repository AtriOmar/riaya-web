ALTER TABLE "consultation_recording" ADD COLUMN "summary" jsonb;--> statement-breakpoint
ALTER TABLE "consultation_recording" ADD COLUMN "summary_status" varchar(50);--> statement-breakpoint
ALTER TABLE "consultation_recording" ADD COLUMN "summary_cost_micro_usd" integer;