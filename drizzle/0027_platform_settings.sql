CREATE TABLE "platform_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"pending_timeout_minutes" integer DEFAULT 10 NOT NULL,
	"emergency_wave_timeout_minutes" integer DEFAULT 4 NOT NULL,
	"emergency_fanout_count" integer DEFAULT 3 NOT NULL,
	"emergency_max_waves" integer DEFAULT 3 NOT NULL,
	"updated_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "platform_settings_single_row" CHECK ("platform_settings"."id" = 1),
	CONSTRAINT "platform_settings_pending_timeout_range" CHECK ("platform_settings"."pending_timeout_minutes" between 1 and 120),
	CONSTRAINT "platform_settings_wave_timeout_range" CHECK ("platform_settings"."emergency_wave_timeout_minutes" between 1 and 30),
	CONSTRAINT "platform_settings_fanout_range" CHECK ("platform_settings"."emergency_fanout_count" between 1 and 10),
	CONSTRAINT "platform_settings_max_waves_range" CHECK ("platform_settings"."emergency_max_waves" between 1 and 10)
);
--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;