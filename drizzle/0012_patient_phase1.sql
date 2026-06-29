CREATE TYPE "public"."patient_type" AS ENUM('new', 'existing');--> statement-breakpoint
CREATE TYPE "public"."dental_anxiety" AS ENUM('none', 'mild', 'moderate', 'severe');--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "patient_code" varchar(50);--> statement-breakpoint
UPDATE "patients"
SET "patient_code" = 'PAT' || LPAD(
    ROW_NUMBER() OVER (ORDER BY "created_at")::text,
    6,
    '0'
)
WHERE "patient_code" IS NULL;--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "patient_code" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "patients_patient_code_unique" ON "patients" USING btree ("patient_code");--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "patient_type" "patient_type" DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" RENAME COLUMN "emergency_contact" TO "emergency_contact_name";--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "address" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "emergency_contact_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "emergency_contact_phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "emergency_contact_relation" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "phone" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "gender" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "emergency_contact_phone" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "emergency_contact_relation" SET DATA TYPE varchar(100);--> statement-breakpoint
CREATE TABLE "patient_medical_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"allergies" varchar(255)[],
	"current_medications" varchar(255)[],
	"chronic_conditions" varchar(255)[],
	"pregnancy_status" "pregnancy_status" DEFAULT 'Not Applicable' NOT NULL,
	"dental_anxiety" "dental_anxiety" DEFAULT 'none' NOT NULL,
	"last_dental_visit" timestamp,
	"last_xray_date" timestamp,
	"primary_physician_name" varchar(255),
	"primary_physician_phone" varchar(20),
	"initial_chief_complaint" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "patient_medical_profiles_patient_id_unique" ON "patient_medical_profiles" USING btree ("patient_id");--> statement-breakpoint
INSERT INTO "patient_medical_profiles" (
	"patient_id",
	"allergies",
	"current_medications",
	"chronic_conditions",
	"pregnancy_status",
	"dental_anxiety",
	"initial_chief_complaint",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"allergies",
	"current_medications",
	"chronic_conditions",
	CASE
		WHEN "pregnancy_status" IN ('Not Applicable', 'Pregnant', 'Not Pregnant')
			THEN "pregnancy_status"::"pregnancy_status"
		ELSE 'Not Applicable'::"pregnancy_status"
	END,
	'none'::"dental_anxiety",
	"cheif_complaint",
	"created_at",
	"updated_at"
FROM "patients";--> statement-breakpoint
CREATE TABLE "patient_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"treatment_consent_signed" boolean DEFAULT false NOT NULL,
	"privacy_accepted" boolean DEFAULT false NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "patient_consents_patient_id_unique" ON "patient_consents" USING btree ("patient_id");--> statement-breakpoint
INSERT INTO "patient_consents" (
	"patient_id",
	"treatment_consent_signed",
	"privacy_accepted",
	"accepted_at",
	"created_at"
)
SELECT
	"id",
	true,
	true,
	"created_at",
	"created_at"
FROM "patients";--> statement-breakpoint
ALTER TABLE "patient_medical_profiles" ADD CONSTRAINT "patient_medical_profiles_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_consents" ADD CONSTRAINT "patient_consents_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" DROP COLUMN "allergies";--> statement-breakpoint
ALTER TABLE "patients" DROP COLUMN "current_medications";--> statement-breakpoint
ALTER TABLE "patients" DROP COLUMN "chronic_conditions";--> statement-breakpoint
ALTER TABLE "patients" DROP COLUMN "cheif_complaint";--> statement-breakpoint
ALTER TABLE "patients" DROP COLUMN "pregnancy_status";--> statement-breakpoint
ALTER TABLE "patients" DROP CONSTRAINT "patients_email_unique";--> statement-breakpoint
