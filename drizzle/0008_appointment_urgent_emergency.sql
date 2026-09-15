ALTER TABLE "appointment" ADD COLUMN "urgent" boolean DEFAULT false NOT NULL;
ALTER TABLE "appointment" ADD COLUMN "emergency_group_id" varchar(64);
CREATE INDEX "appointment_emergency_group_id_idx" ON "appointment" ("emergency_group_id");
