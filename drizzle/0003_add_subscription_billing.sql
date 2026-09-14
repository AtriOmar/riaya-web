CREATE TABLE "billing_invoice" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "billing_invoice_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"doctor_id" integer NOT NULL,
	"subscription_id" integer,
	"number" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'open' NOT NULL,
	"amount_millimes" integer NOT NULL,
	"konnect_payment_ref" varchar(255),
	"konnect_pay_url" varchar(1024),
	"period_start" timestamp,
	"period_end" timestamp,
	"due_date" timestamp,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "billing_invoice_number_unique" UNIQUE("number"),
	CONSTRAINT "billing_invoice_konnect_payment_ref_unique" UNIQUE("konnect_payment_ref")
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "subscription_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"doctor_id" integer NOT NULL,
	"plan_id" varchar(50) DEFAULT 'free' NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "subscription_doctor_id_unique" UNIQUE("doctor_id")
);
--> statement-breakpoint
ALTER TABLE "billing_invoice" ADD CONSTRAINT "billing_invoice_doctor_id_doctor_profile_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctor_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_invoice" ADD CONSTRAINT "billing_invoice_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_doctor_id_doctor_profile_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctor_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_invoice_doctor_id_idx" ON "billing_invoice" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "billing_invoice_status_idx" ON "billing_invoice" USING btree ("status");--> statement-breakpoint
CREATE INDEX "billing_invoice_konnect_ref_idx" ON "billing_invoice" USING btree ("konnect_payment_ref");--> statement-breakpoint
CREATE INDEX "subscription_doctor_id_idx" ON "subscription" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "subscription_plan_id_idx" ON "subscription" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "subscription_status_idx" ON "subscription" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscription_period_end_idx" ON "subscription" USING btree ("current_period_end");