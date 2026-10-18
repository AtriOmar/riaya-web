ALTER TABLE "ai_chat_message" ADD COLUMN "prompt_tokens" integer;--> statement-breakpoint
ALTER TABLE "ai_chat_message" ADD COLUMN "completion_tokens" integer;--> statement-breakpoint
ALTER TABLE "ai_chat_message" ADD COLUMN "cost_micro_usd" integer;