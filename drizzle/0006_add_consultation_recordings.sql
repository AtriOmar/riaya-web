CREATE TABLE "consultation_recording" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "consultation_recording_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"doctor_id" integer NOT NULL,
	"patient_id" integer,
	"title" varchar(255),
	"audio_url" varchar(1024) NOT NULL,
	"duration_seconds" integer,
	"transcript" text,
	"transcript_status" varchar(50) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "consultation_recording" ADD CONSTRAINT "consultation_recording_doctor_id_doctor_profile_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctor_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_recording" ADD CONSTRAINT "consultation_recording_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consultation_recording_doctor_id_idx" ON "consultation_recording" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "consultation_recording_patient_id_idx" ON "consultation_recording" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "consultation_recording_created_at_idx" ON "consultation_recording" USING btree ("created_at");