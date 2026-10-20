ALTER TABLE "doctor_profile" ADD COLUMN "best_fit_excluded_at" timestamp;--> statement-breakpoint
ALTER TABLE "doctor_profile" ADD COLUMN "best_fit_excluded_by" text;--> statement-breakpoint
ALTER TABLE "doctor_profile" ADD COLUMN "best_fit_excluded_reason" text;--> statement-breakpoint
ALTER TABLE "doctor_profile" ADD CONSTRAINT "doctor_profile_best_fit_excluded_by_user_id_fk" FOREIGN KEY ("best_fit_excluded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_profile" ADD CONSTRAINT "doctor_profile_best_fit_exclusion_reason" CHECK (("doctor_profile"."best_fit_excluded_at" is null) = ("doctor_profile"."best_fit_excluded_reason" is null));