CREATE TABLE "recording_usage" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "recording_usage_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"doctor_id" integer NOT NULL,
	"recording_id" integer,
	"seconds" integer NOT NULL,
	"credit_seconds" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recording_usage_recording_id_unique" UNIQUE("recording_id")
);
--> statement-breakpoint
ALTER TABLE "billing_invoice" ADD COLUMN "kind" varchar(50) DEFAULT 'subscription' NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_invoice" ADD COLUMN "credit_seconds" integer;--> statement-breakpoint
ALTER TABLE "recording_usage" ADD CONSTRAINT "recording_usage_doctor_id_doctor_profile_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctor_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recording_usage" ADD CONSTRAINT "recording_usage_recording_id_consultation_recording_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."consultation_recording"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recording_usage_doctor_created_idx" ON "recording_usage" USING btree ("doctor_id","created_at");