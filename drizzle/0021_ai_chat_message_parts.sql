-- Messages move from one text column to a list of parts. Existing chats are
-- dropped (no data copy while in development); messages go with them.
DELETE FROM "ai_chat_conversation";--> statement-breakpoint
ALTER TABLE "ai_chat_message" ADD COLUMN "parts" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_chat_message" DROP COLUMN "content";