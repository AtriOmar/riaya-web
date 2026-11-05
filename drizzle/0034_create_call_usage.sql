CREATE TABLE "call_usage" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "call_usage_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"call_id" integer NOT NULL,
	"model" varchar(100) NOT NULL,
	"text_input_tokens" integer DEFAULT 0 NOT NULL,
	"audio_input_tokens" integer DEFAULT 0 NOT NULL,
	"text_output_tokens" integer DEFAULT 0 NOT NULL,
	"audio_output_tokens" integer DEFAULT 0 NOT NULL,
	"raw" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "call_usage" ADD CONSTRAINT "call_usage_call_id_call_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."call"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "call_usage_call_id_model_idx" ON "call_usage" USING btree ("call_id","model");