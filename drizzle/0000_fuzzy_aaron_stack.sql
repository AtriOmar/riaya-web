CREATE TABLE "appointment" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "appointment_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"doctor_id" integer,
	"patient_id" integer,
	"start" timestamp,
	"end" timestamp,
	"status" varchar(50),
	"name" varchar(255),
	"description" text,
	"new_patient_name" varchar(255),
	"new_patient_phone_number" varchar(50),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "call" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "call_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"call_sid" varchar(100) NOT NULL,
	"from" varchar(50),
	"to" varchar(50),
	"direction" varchar(50),
	"status" varchar(50) DEFAULT 'in-progress',
	"caller_name" varchar(255),
	"started_at" timestamp DEFAULT now(),
	"ended_at" timestamp,
	"duration" integer,
	"appointment_id" integer,
	"recording_sid" varchar(100),
	"recording_key" varchar(512),
	"recording_url" varchar(1024),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "call_call_sid_unique" UNIQUE("call_sid")
);
--> statement-breakpoint
CREATE TABLE "call_event" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "call_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"call_id" integer NOT NULL,
	"type" varchar(50) NOT NULL,
	"content" text,
	"function_name" varchar(100),
	"function_args" jsonb,
	"function_result" jsonb,
	"function_status" varchar(50),
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cities" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"postal_code" integer,
	"latitude" double precision,
	"longitude" double precision,
	"en_name" varchar(255),
	"fr_name" varchar(255),
	"ar_name" varchar(255),
	"slug" varchar(255),
	CONSTRAINT "cities_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "consultation" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "consultation_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"patient_id" integer,
	"doctor_id" integer,
	"date" timestamp,
	"title" varchar(255),
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "doctor_application" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "doctor_application_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text,
	"first_name" varchar(255),
	"last_name" varchar(255),
	"cin_recto" varchar(255),
	"cin_verso" varchar(255),
	"cabinet_name" varchar(255),
	"cabinet_city_id" integer,
	"cabinet_longitude" double precision,
	"cabinet_latitude" double precision,
	"status" varchar(50) DEFAULT 'pending',
	"tin" varchar(100),
	"rejection_reasons" text[],
	"speciality_id" integer,
	"medical_council_number" varchar(100),
	"medical_council_certificate" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "doctor_profile" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "doctor_profile_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"first_name" varchar(255),
	"last_name" varchar(255),
	"cin" varchar(100),
	"tin" varchar(100),
	"status" varchar(50) DEFAULT 'none',
	"address" text,
	"cabinet_name" varchar(255),
	"cabinet_city_id" integer,
	"cabinet_longitude" double precision,
	"cabinet_latitude" double precision,
	"speciality_id" integer,
	"availability" jsonb,
	"cin_recto" varchar(255),
	"cin_verso" varchar(255),
	"medical_council_number" varchar(100),
	"medical_council_certificate" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "doctor_profile_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "doctor_unavailability" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "doctor_unavailability_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"doctor_id" integer,
	"start" timestamp,
	"end" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "patient" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "patient_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"person_id" integer,
	"doctor_id" integer,
	"cin" varchar(100),
	"first_name" varchar(255),
	"last_name" varchar(255),
	"date_of_birth" timestamp,
	"gender" varchar(50),
	"address" text,
	"phone_number" varchar(50),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "patient_medical_file" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "patient_medical_file_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"patient_id" integer,
	"type" varchar(100),
	"date" timestamp,
	"title" varchar(255),
	"description" text,
	"documents" text[],
	"sent_via_whatsapp" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "person" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "person_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"phone_number" varchar(50) NOT NULL,
	"source" varchar(50) DEFAULT 'call' NOT NULL,
	"first_name" varchar(255),
	"last_name" varchar(255),
	"date_of_birth" timestamp,
	"gender" varchar(50),
	"address" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "person_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
CREATE TABLE "review" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "review_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"appointment_id" integer,
	"doctor_id" integer,
	"patient_id" integer,
	"token" varchar(255) NOT NULL,
	"rating" integer,
	"wait_time" varchar(50),
	"comment" text,
	"status" varchar(50) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "review_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "speciality" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "speciality_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"en_name" varchar(255),
	"fr_name" varchar(255),
	"ar_name" varchar(255),
	"slug" varchar(255),
	CONSTRAINT "speciality_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"display_name" varchar(255),
	"username" varchar(255),
	"access_id" integer DEFAULT 1,
	"active" integer DEFAULT 2,
	"type" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_doctor_id_doctor_profile_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctor_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call" ADD CONSTRAINT "call_appointment_id_appointment_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_event" ADD CONSTRAINT "call_event_call_id_call_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."call"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation" ADD CONSTRAINT "consultation_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation" ADD CONSTRAINT "consultation_doctor_id_doctor_profile_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctor_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_application" ADD CONSTRAINT "doctor_application_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_application" ADD CONSTRAINT "doctor_application_cabinet_city_id_cities_id_fk" FOREIGN KEY ("cabinet_city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_application" ADD CONSTRAINT "doctor_application_speciality_id_speciality_id_fk" FOREIGN KEY ("speciality_id") REFERENCES "public"."speciality"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_profile" ADD CONSTRAINT "doctor_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_profile" ADD CONSTRAINT "doctor_profile_cabinet_city_id_cities_id_fk" FOREIGN KEY ("cabinet_city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_profile" ADD CONSTRAINT "doctor_profile_speciality_id_speciality_id_fk" FOREIGN KEY ("speciality_id") REFERENCES "public"."speciality"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_unavailability" ADD CONSTRAINT "doctor_unavailability_doctor_id_doctor_profile_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctor_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient" ADD CONSTRAINT "patient_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient" ADD CONSTRAINT "patient_doctor_id_doctor_profile_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctor_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_medical_file" ADD CONSTRAINT "patient_medical_file_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_appointment_id_appointment_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_doctor_id_doctor_profile_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctor_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointment_doctor_id_idx" ON "appointment" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "appointment_patient_id_idx" ON "appointment" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "appointment_status_idx" ON "appointment" USING btree ("status");--> statement-breakpoint
CREATE INDEX "appointment_start_idx" ON "appointment" USING btree ("start");--> statement-breakpoint
CREATE INDEX "call_call_sid_idx" ON "call" USING btree ("call_sid");--> statement-breakpoint
CREATE INDEX "call_status_idx" ON "call" USING btree ("status");--> statement-breakpoint
CREATE INDEX "call_started_at_idx" ON "call" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "call_appointment_id_idx" ON "call" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "call_event_call_id_idx" ON "call_event" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "call_event_type_idx" ON "call_event" USING btree ("type");--> statement-breakpoint
CREATE INDEX "call_event_timestamp_idx" ON "call_event" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "cities_postal_code_idx" ON "cities" USING btree ("postal_code");--> statement-breakpoint
CREATE INDEX "cities_slug_idx" ON "cities" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "consultation_patient_id_idx" ON "consultation" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "consultation_doctor_id_idx" ON "consultation" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "doctor_application_user_id_idx" ON "doctor_application" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "doctor_application_status_idx" ON "doctor_application" USING btree ("status");--> statement-breakpoint
CREATE INDEX "doctor_application_cabinet_city_id_idx" ON "doctor_application" USING btree ("cabinet_city_id");--> statement-breakpoint
CREATE INDEX "doctor_application_speciality_id_idx" ON "doctor_application" USING btree ("speciality_id");--> statement-breakpoint
CREATE INDEX "doctor_profile_user_id_idx" ON "doctor_profile" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "doctor_profile_status_idx" ON "doctor_profile" USING btree ("status");--> statement-breakpoint
CREATE INDEX "doctor_profile_cabinet_city_id_idx" ON "doctor_profile" USING btree ("cabinet_city_id");--> statement-breakpoint
CREATE INDEX "doctor_profile_speciality_id_idx" ON "doctor_profile" USING btree ("speciality_id");--> statement-breakpoint
CREATE INDEX "doctor_profile_cin_idx" ON "doctor_profile" USING btree ("cin");--> statement-breakpoint
CREATE INDEX "doctor_unavailability_doctor_id_idx" ON "doctor_unavailability" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "doctor_unavailability_start_idx" ON "doctor_unavailability" USING btree ("start");--> statement-breakpoint
CREATE INDEX "patient_doctor_profile_id_idx" ON "patient" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "patient_cin_idx" ON "patient" USING btree ("cin");--> statement-breakpoint
CREATE INDEX "patient_medical_file_patient_id_idx" ON "patient_medical_file" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "person_phone_number_idx" ON "person" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "review_appointment_id_idx" ON "review" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "review_doctor_id_idx" ON "review" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "review_patient_id_idx" ON "review" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "review_token_idx" ON "review" USING btree ("token");--> statement-breakpoint
CREATE INDEX "speciality_slug_idx" ON "speciality" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");