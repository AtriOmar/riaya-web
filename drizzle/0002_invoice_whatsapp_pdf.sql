ALTER TABLE "invoice" ADD COLUMN "pdf_url" varchar(1024);--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "sent_via_whatsapp" boolean DEFAULT false;