CREATE TABLE "ai_chat_conversation" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_chat_conversation_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"doctor_id" integer NOT NULL,
	"title" varchar(255),
	"recording_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_chat_message" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_chat_message_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"conversation_id" integer NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "ai_chat_conversation" ADD CONSTRAINT "ai_chat_conversation_doctor_id_doctor_profile_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctor_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chat_conversation" ADD CONSTRAINT "ai_chat_conversation_recording_id_consultation_recording_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."consultation_recording"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chat_message" ADD CONSTRAINT "ai_chat_message_conversation_id_ai_chat_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_chat_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_chat_conversation_doctor_id_idx" ON "ai_chat_conversation" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "ai_chat_conversation_recording_id_idx" ON "ai_chat_conversation" USING btree ("recording_id");--> statement-breakpoint
CREATE INDEX "ai_chat_conversation_updated_at_idx" ON "ai_chat_conversation" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "ai_chat_message_conversation_id_idx" ON "ai_chat_message" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "ai_chat_message_created_at_idx" ON "ai_chat_message" USING btree ("created_at");