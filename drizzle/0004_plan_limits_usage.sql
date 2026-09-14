CREATE TABLE "whatsapp_usage" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "whatsapp_usage_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"doctor_id" integer NOT NULL,
	"period_yyyy_mm" varchar(7) NOT NULL,
	"send_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "appointment" ADD COLUMN "source" varchar(50) DEFAULT 'dashboard' NOT NULL;--> statement-breakpoint
ALTER TABLE "whatsapp_usage" ADD CONSTRAINT "whatsapp_usage_doctor_id_doctor_profile_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctor_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_usage_doctor_period_uidx" ON "whatsapp_usage" USING btree ("doctor_id","period_yyyy_mm");--> statement-breakpoint
CREATE INDEX "whatsapp_usage_doctor_id_idx" ON "whatsapp_usage" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "appointment_source_idx" ON "appointment" USING btree ("source");