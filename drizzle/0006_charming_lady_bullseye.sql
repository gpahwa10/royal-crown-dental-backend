CREATE TYPE "public"."pregnancy_status" AS ENUM('Not Applicable', 'Pregnant', 'Not Pregnant');--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(255) NOT NULL,
	"gender" varchar(255) NOT NULL,
	"date_of_birth" timestamp NOT NULL,
	"address" text NOT NULL,
	"emergency_contact" varchar(255) NOT NULL,
	"emergency_contact_phone" varchar(255) NOT NULL,
	"emergency_contact_relation" varchar(255) NOT NULL,
	"clinic_id" uuid NOT NULL,
	"allergies" varchar(255)[],
	"current_medications" varchar(255)[],
	"chronic_conditions" varchar(255)[],
	"cheif_complaint" text NOT NULL,
	"pregnancy_status" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_visit_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_black_listed" boolean DEFAULT false NOT NULL,
	"black_listed_reason" text,
	"is_premium_member" boolean DEFAULT false NOT NULL,
	CONSTRAINT "patients_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "super_admins" ADD COLUMN "name" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "super_admins" DROP COLUMN "first_name";--> statement-breakpoint
ALTER TABLE "super_admins" DROP COLUMN "last_name";