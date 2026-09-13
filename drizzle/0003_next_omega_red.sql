CREATE TABLE "invoice_payment" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "invoice_payment_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"invoice_id" integer NOT NULL,
	"amount_centimes" integer NOT NULL,
	"payment_method" varchar(50) NOT NULL,
	"paid_at" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "invoice_payment" ADD CONSTRAINT "invoice_payment_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_payment_invoice_id_idx" ON "invoice_payment" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_payment_paid_at_idx" ON "invoice_payment" USING btree ("paid_at");