CREATE TYPE "public"."patient_type" AS ENUM('new', 'existing');--> statement-breakpoint
CREATE TYPE "public"."dental_anxiety" AS ENUM('none', 'mild', 'moderate', 'severe');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'paid', 'partially_paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."lab_request_status" AS ENUM('sample_collected', 'sent_to_lab', 'under_examination', 'delivered');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'upi', 'card', 'bank_transfer');--> statement-breakpoint
CREATE TYPE "public"."radiograph_status" AS ENUM('scheduled', 'acquired', 'reported');--> statement-breakpoint
ALTER TYPE "public"."appointment_status" ADD VALUE 'checked_in' BEFORE 'completed';--> statement-breakpoint
ALTER TYPE "public"."appointment_status" ADD VALUE 'in_progress' BEFORE 'completed';--> statement-breakpoint
CREATE TABLE "consultations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_code" varchar(50) NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"appointment_id" uuid,
	"chief_complaint" text NOT NULL,
	"diagnosis" text,
	"treatment_plan" text,
	"clinical_notes" text,
	"next_visit_date" timestamp,
	"consent_required" boolean DEFAULT false NOT NULL,
	"consent_signed" boolean DEFAULT false NOT NULL,
	"consent_signature_url" text,
	"consent_signed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follow_ups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"follow_up_date" timestamp NOT NULL,
	"notes" text,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE TABLE "patient_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"treatment_consent_signed" boolean DEFAULT false NOT NULL,
	"privacy_accepted" boolean DEFAULT false NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"consultation_id" uuid,
	"patient_id" uuid NOT NULL,
	"clinic_id" uuid NOT NULL,
	"subtotal" integer NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"tax" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"service_id" uuid,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"amount" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lab_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lab_request_id" uuid NOT NULL,
	"report_url" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lab_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"clinic_id" uuid NOT NULL,
	"external_lab_name" text,
	"notes" text,
	"status" "lab_request_status" DEFAULT 'sample_collected' NOT NULL,
	"sent_date" timestamp,
	"delivered_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lab_request_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lab_request_id" uuid NOT NULL,
	"test_name" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"transaction_reference" text,
	"paid_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prescription_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prescription_id" uuid NOT NULL,
	"medicine_name" text NOT NULL,
	"dosage" text,
	"frequency" text,
	"duration" text,
	"instructions" text
);
--> statement-breakpoint
CREATE TABLE "prescriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radiographs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"clinic_id" uuid NOT NULL,
	"study_type" text NOT NULL,
	"tooth_region" text,
	"scheduled_date" timestamp,
	"notes" text,
	"image_url" text,
	"report_text" text,
	"status" "radiograph_status" DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid,
	"name" text NOT NULL,
	"category" text,
	"price" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "patients" DROP CONSTRAINT "patients_email_unique";--> statement-breakpoint
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_clinic_id_clinics_id_fk";
--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "status" SET DEFAULT 'new_query'::text;--> statement-breakpoint
DROP TYPE "public"."lead_status";--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new_query', 'follow_up', 'appointment_booked', 'clinic_visited', 'converted', 'closed_lost', 'no_show');--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "status" SET DEFAULT 'new_query'::"public"."lead_status";--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "status" SET DATA TYPE "public"."lead_status" USING "status"::"public"."lead_status";--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "status" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "phone" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "gender" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "address" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "emergency_contact_phone" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "emergency_contact_phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "emergency_contact_relation" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "patients" ALTER COLUMN "emergency_contact_relation" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "appointment_code" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "duration_minutes" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "checked_in_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "cancelled_reason" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "patient_code" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "patient_type" "patient_type" DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "emergency_contact_name" varchar(255);--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_doctor_id_employees_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_medical_profiles" ADD CONSTRAINT "patient_medical_profiles_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_consents" ADD CONSTRAINT "patient_consents_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_lab_request_id_lab_requests_id_fk" FOREIGN KEY ("lab_request_id") REFERENCES "public"."lab_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_requests" ADD CONSTRAINT "lab_requests_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_requests" ADD CONSTRAINT "lab_requests_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_requests" ADD CONSTRAINT "lab_requests_doctor_id_employees_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_requests" ADD CONSTRAINT "lab_requests_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_request_tests" ADD CONSTRAINT "lab_request_tests_lab_request_id_lab_requests_id_fk" FOREIGN KEY ("lab_request_id") REFERENCES "public"."lab_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescription_id_prescriptions_id_fk" FOREIGN KEY ("prescription_id") REFERENCES "public"."prescriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_doctor_id_employees_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiographs" ADD CONSTRAINT "radiographs_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiographs" ADD CONSTRAINT "radiographs_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiographs" ADD CONSTRAINT "radiographs_doctor_id_employees_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiographs" ADD CONSTRAINT "radiographs_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "patient_medical_profiles_patient_id_unique" ON "patient_medical_profiles" USING btree ("patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "patient_consents_patient_id_unique" ON "patient_consents" USING btree ("patient_id");--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "patients_patient_code_unique" ON "patients" USING btree ("patient_code");--> statement-breakpoint
ALTER TABLE "patients" DROP COLUMN "emergency_contact";--> statement-breakpoint
ALTER TABLE "patients" DROP COLUMN "allergies";--> statement-breakpoint
ALTER TABLE "patients" DROP COLUMN "current_medications";--> statement-breakpoint
ALTER TABLE "patients" DROP COLUMN "chronic_conditions";--> statement-breakpoint
ALTER TABLE "patients" DROP COLUMN "cheif_complaint";--> statement-breakpoint
ALTER TABLE "patients" DROP COLUMN "pregnancy_status";