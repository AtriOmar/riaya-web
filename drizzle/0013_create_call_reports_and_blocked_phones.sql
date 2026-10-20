CREATE TABLE "blocked_phone" (
	"phone_number" varchar(50) PRIMARY KEY NOT NULL,
	"reason" text,
	"report_id" integer,
	"blocked_by" text,
	"expires_at" timestamp,
	"rejected_call_count" integer DEFAULT 0 NOT NULL,
	"last_rejected_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call_report" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "call_report_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"call_id" integer NOT NULL,
	"phone_number" varchar(50) NOT NULL,
	"category" varchar(20) NOT NULL,
	"summary" text NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "call_report_call_id_unique" UNIQUE("call_id")
);
--> statement-breakpoint
ALTER TABLE "blocked_phone" ADD CONSTRAINT "blocked_phone_report_id_call_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."call_report"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocked_phone" ADD CONSTRAINT "blocked_phone_blocked_by_user_id_fk" FOREIGN KEY ("blocked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_report" ADD CONSTRAINT "call_report_call_id_call_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."call"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_report" ADD CONSTRAINT "call_report_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "call_report_status_idx" ON "call_report" USING btree ("status");--> statement-breakpoint
CREATE INDEX "call_report_phone_number_idx" ON "call_report" USING btree ("phone_number");