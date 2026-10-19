CREATE TYPE "public"."review_status" AS ENUM('pending', 'submitted');--> statement-breakpoint
CREATE TYPE "public"."review_wait_time" AS ENUM('short', 'medium', 'long');--> statement-breakpoint
UPDATE "review" SET "status" = 'submitted' WHERE "status" = 'completed';--> statement-breakpoint
UPDATE "review" SET "status" = 'pending' WHERE "status" IS NULL;--> statement-breakpoint
ALTER TABLE "review" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
UPDATE "review" SET "expires_at" = COALESCE("created_at", now()) + interval '30 days';--> statement-breakpoint
ALTER TABLE "review" ALTER COLUMN "expires_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "review" ALTER COLUMN "appointment_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "review" ALTER COLUMN "doctor_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "review" ALTER COLUMN "wait_time" SET DATA TYPE "public"."review_wait_time" USING "wait_time"::"public"."review_wait_time";--> statement-breakpoint
ALTER TABLE "review" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "review" ALTER COLUMN "status" SET DATA TYPE "public"."review_status" USING "status"::"public"."review_status";--> statement-breakpoint
ALTER TABLE "review" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "review" ALTER COLUMN "status" SET NOT NULL;
