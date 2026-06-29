CREATE TYPE "public"."clinic_visit_purpose" AS ENUM('consultation', 'treatment', 'follow_up', 'enquiry', 'emergency', 'billing', 'membership', 'report_collection', 'medicine_collection', 'document_submission', 'other');--> statement-breakpoint
CREATE TYPE "public"."clinic_visit_outcome" AS ENUM('enquiry_only', 'appointment_booked', 'patient_registered', 'consultation_completed', 'treatment_started', 'treatment_completed', 'billing_completed', 'membership_purchased', 'reports_collected', 'cancelled', 'left_without_consultation', 'referred', 'other');--> statement-breakpoint
CREATE TYPE "public"."clinic_visit_status" AS ENUM('checked_in', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "clinic_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_number" varchar(50) NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid,
	"lead_id" uuid,
	"appointment_id" uuid,
	"consultation_id" uuid,
	"invoice_id" uuid,
	"membership_id" uuid,
	"visitor_name" text NOT NULL,
	"visitor_phone" varchar(20) NOT NULL,
	"visitor_email" varchar(255),
	"doctor_id" uuid,
	"visit_date" timestamp NOT NULL,
	"check_in_time" timestamp NOT NULL,
	"check_out_time" timestamp,
	"purpose" "clinic_visit_purpose" NOT NULL,
	"outcome" "clinic_visit_outcome",
	"status" "clinic_visit_status" DEFAULT 'checked_in' NOT NULL,
	"is_registered" boolean DEFAULT false NOT NULL,
	"treatment_performed" text,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "clinic_visits_visit_number_unique" ON "clinic_visits" USING btree ("visit_number");--> statement-breakpoint
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_membership_id_patient_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."patient_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_doctor_id_employees_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "clinic_visit_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_visit_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "clinic_visit_files_visit_file_unique" ON "clinic_visit_files" USING btree ("clinic_visit_id","file_id");--> statement-breakpoint
ALTER TABLE "clinic_visit_files" ADD CONSTRAINT "clinic_visit_files_clinic_visit_id_clinic_visits_id_fk" FOREIGN KEY ("clinic_visit_id") REFERENCES "public"."clinic_visits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_visit_files" ADD CONSTRAINT "clinic_visit_files_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;
