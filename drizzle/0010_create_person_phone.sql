CREATE TABLE "person_phone" (
	"person_id" integer NOT NULL,
	"phone_number" varchar(50) NOT NULL,
	"relationship" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "person_phone_person_id_phone_number_pk" PRIMARY KEY("person_id","phone_number")
);
--> statement-breakpoint
ALTER TABLE "person" DROP CONSTRAINT "person_phone_number_unique";--> statement-breakpoint
DROP INDEX "person_phone_number_idx";--> statement-breakpoint
ALTER TABLE "person_phone" ADD CONSTRAINT "person_phone_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "person_phone_phone_number_idx" ON "person_phone" USING btree ("phone_number");--> statement-breakpoint
CREATE UNIQUE INDEX "person_phone_one_owner_idx" ON "person_phone" USING btree ("phone_number") WHERE "person_phone"."relationship" = 'self';--> statement-breakpoint
ALTER TABLE "person" DROP COLUMN "phone_number";