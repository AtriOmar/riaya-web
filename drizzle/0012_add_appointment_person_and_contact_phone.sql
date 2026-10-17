ALTER TABLE "appointment" ADD COLUMN "person_id" integer;--> statement-breakpoint
ALTER TABLE "appointment" ADD COLUMN "contact_phone" varchar(50);--> statement-breakpoint
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointment_person_id_idx" ON "appointment" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "appointment_contact_phone_idx" ON "appointment" USING btree ("contact_phone");