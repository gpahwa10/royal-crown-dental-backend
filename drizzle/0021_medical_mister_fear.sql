CREATE TYPE "public"."appointment_type" AS ENUM('general', 'consultation', 'treatment', 'follow_up');--> statement-breakpoint
CREATE TYPE "public"."clinic_visit_outcome" AS ENUM('enquiry_only', 'appointment_booked', 'patient_registered', 'consultation_completed', 'treatment_started', 'treatment_completed', 'billing_completed', 'membership_purchased', 'reports_collected', 'cancelled', 'left_without_consultation', 'referred', 'other');--> statement-breakpoint
CREATE TYPE "public"."clinic_visit_purpose" AS ENUM('consultation', 'treatment', 'follow_up', 'enquiry', 'emergency', 'billing', 'membership', 'report_collection', 'medicine_collection', 'document_submission', 'other');--> statement-breakpoint
CREATE TYPE "public"."clinic_visit_status" AS ENUM('checked_in', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."consultation_status" AS ENUM('draft', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."dental_lab_order_status" AS ENUM('ordered', 'delivered', 'cementation_done');--> statement-breakpoint
CREATE TYPE "public"."file_document_type" AS ENUM('lab_report', 'radiograph', 'prescription', 'invoice', 'consent', 'treatment', 'patient_document', 'other');--> statement-breakpoint
CREATE TYPE "public"."file_upload_status" AS ENUM('pending_upload', 'uploaded', 'archived');--> statement-breakpoint
CREATE TYPE "public"."membership_discount_type" AS ENUM('percentage', 'fixed', 'free');--> statement-breakpoint
CREATE TYPE "public"."patient_membership_status" AS ENUM('pending_payment', 'active', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."invoice_source_type" AS ENUM('consultation', 'lab_request', 'radiograph', 'dental_lab', 'membership', 'manual');--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'finance' BEFORE 'bank_transfer';--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'cheque';--> statement-breakpoint
CREATE TABLE "clinic_visit_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_visit_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "dental_lab_order_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dental_lab_order_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dental_lab_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_code" varchar(50) NOT NULL,
	"patient_id" uuid NOT NULL,
	"consultation_id" uuid,
	"clinic_id" uuid NOT NULL,
	"measured_by_doctor_id" uuid NOT NULL,
	"cementation_doctor_id" uuid,
	"cementation_appointment_id" uuid,
	"lab_name" text NOT NULL,
	"item_type" text NOT NULL,
	"tooth_number" text,
	"shade" text,
	"description" text,
	"estimated_delivery_date" timestamp,
	"ordered_date" timestamp DEFAULT now() NOT NULL,
	"delivered_date" timestamp,
	"cementation_date" timestamp,
	"status" "dental_lab_order_status" DEFAULT 'ordered' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"clinic_id" uuid NOT NULL,
	"document_type" "file_document_type" NOT NULL,
	"original_file_name" text NOT NULL,
	"object_key" text NOT NULL,
	"bucket" text NOT NULL,
	"content_type" text NOT NULL,
	"file_size" bigint,
	"status" "file_upload_status" DEFAULT 'pending_upload' NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_code" varchar(50) NOT NULL,
	"service_name" text NOT NULL,
	"description" text,
	"category" text,
	"default_price" integer NOT NULL,
	"tax_percentage" integer DEFAULT 0 NOT NULL,
	"is_taxable" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"clinic_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_code" varchar(50) NOT NULL,
	"plan_name" text NOT NULL,
	"description" text,
	"price" integer NOT NULL,
	"validity_days" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership_plan_benefits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_plan_id" uuid NOT NULL,
	"service_code" varchar(50) NOT NULL,
	"discount_type" "membership_discount_type" NOT NULL,
	"discount_value" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"membership_plan_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"purchase_date" timestamp DEFAULT now() NOT NULL,
	"start_date" timestamp,
	"expiry_date" timestamp,
	"status" "patient_membership_status" DEFAULT 'pending_payment' NOT NULL,
	"purchased_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "services" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "services" CASCADE;--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_invoice_number_unique";--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_consultation_id_consultations_id_fk";
--> statement-breakpoint
ALTER TABLE "invoice_items" DROP CONSTRAINT "invoice_items_service_id_services_id_fk";
--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "status" SET DEFAULT 'pending'::text;--> statement-breakpoint
DROP TYPE "public"."invoice_status";--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'pending', 'partially_paid', 'paid', 'cancelled', 'refunded');--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."invoice_status";--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "status" SET DATA TYPE "public"."invoice_status" USING "status"::"public"."invoice_status";--> statement-breakpoint
ALTER TABLE "lab_requests" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "lab_requests" ALTER COLUMN "status" SET DEFAULT 'sample_collected'::text;--> statement-breakpoint
DROP TYPE "public"."lab_request_status";--> statement-breakpoint
CREATE TYPE "public"."lab_request_status" AS ENUM('sample_collected', 'under_examination', 'delivered');--> statement-breakpoint
ALTER TABLE "lab_requests" ALTER COLUMN "status" SET DEFAULT 'sample_collected'::"public"."lab_request_status";--> statement-breakpoint
ALTER TABLE "lab_requests" ALTER COLUMN "status" SET DATA TYPE "public"."lab_request_status" USING "status"::"public"."lab_request_status";--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "invoice_number" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "lab_requests" ALTER COLUMN "consultation_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "appointment_type" "appointment_type" DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "dental_lab_order_id" uuid;--> statement-breakpoint
ALTER TABLE "consultations" ADD COLUMN "status" "consultation_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "source_type" "invoice_source_type" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "source_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "membership_discount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "manual_discount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "tax_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "grand_total" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "amount_paid" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "balance_amount" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "generated_by" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "invoice_pdf_file_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "service_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "discount_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "tax_percentage" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "tax_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "line_total" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "lab_reports" ADD COLUMN "file_id" uuid;--> statement-breakpoint
ALTER TABLE "lab_reports" ADD COLUMN "report_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lab_requests" ADD COLUMN "lab_request_code" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "lab_requests" ADD COLUMN "collected_date" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "lab_requests" ADD COLUMN "under_examination_date" timestamp;--> statement-breakpoint
ALTER TABLE "lab_requests" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "payment_reference" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "payment_date" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "received_by" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "prescription_items" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "radiographs" ADD COLUMN "image_file_id" uuid;--> statement-breakpoint
ALTER TABLE "radiographs" ADD COLUMN "report_file_id" uuid;--> statement-breakpoint
ALTER TABLE "clinic_visit_files" ADD CONSTRAINT "clinic_visit_files_clinic_visit_id_clinic_visits_id_fk" FOREIGN KEY ("clinic_visit_id") REFERENCES "public"."clinic_visits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_visit_files" ADD CONSTRAINT "clinic_visit_files_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_membership_id_patient_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."patient_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_doctor_id_employees_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_lab_order_files" ADD CONSTRAINT "dental_lab_order_files_dental_lab_order_id_dental_lab_orders_id_fk" FOREIGN KEY ("dental_lab_order_id") REFERENCES "public"."dental_lab_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_lab_order_files" ADD CONSTRAINT "dental_lab_order_files_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_lab_orders" ADD CONSTRAINT "dental_lab_orders_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_lab_orders" ADD CONSTRAINT "dental_lab_orders_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_lab_orders" ADD CONSTRAINT "dental_lab_orders_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_lab_orders" ADD CONSTRAINT "dental_lab_orders_measured_by_doctor_id_employees_id_fk" FOREIGN KEY ("measured_by_doctor_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_lab_orders" ADD CONSTRAINT "dental_lab_orders_cementation_doctor_id_employees_id_fk" FOREIGN KEY ("cementation_doctor_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_lab_orders" ADD CONSTRAINT "dental_lab_orders_cementation_appointment_id_appointments_id_fk" FOREIGN KEY ("cementation_appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_employees_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_catalog" ADD CONSTRAINT "service_catalog_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_plan_benefits" ADD CONSTRAINT "membership_plan_benefits_membership_plan_id_membership_plans_id_fk" FOREIGN KEY ("membership_plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_memberships" ADD CONSTRAINT "patient_memberships_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_memberships" ADD CONSTRAINT "patient_memberships_membership_plan_id_membership_plans_id_fk" FOREIGN KEY ("membership_plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_memberships" ADD CONSTRAINT "patient_memberships_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_memberships" ADD CONSTRAINT "patient_memberships_purchased_by_employees_id_fk" FOREIGN KEY ("purchased_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clinic_visit_files_visit_file_unique" ON "clinic_visit_files" USING btree ("clinic_visit_id","file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clinic_visits_visit_number_unique" ON "clinic_visits" USING btree ("visit_number");--> statement-breakpoint
CREATE UNIQUE INDEX "dental_lab_order_files_order_file_unique" ON "dental_lab_order_files" USING btree ("dental_lab_order_id","file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dental_lab_orders_order_code_unique" ON "dental_lab_orders" USING btree ("order_code");--> statement-breakpoint
CREATE UNIQUE INDEX "files_object_key_unique" ON "files" USING btree ("object_key");--> statement-breakpoint
CREATE UNIQUE INDEX "service_catalog_clinic_code_unique" ON "service_catalog" USING btree ("clinic_id","service_code");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_plans_plan_code_unique" ON "membership_plans" USING btree ("plan_code");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_generated_by_employees_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_invoice_pdf_file_id_files_id_fk" FOREIGN KEY ("invoice_pdf_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_service_id_service_catalog_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."service_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_employees_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiographs" ADD CONSTRAINT "radiographs_image_file_id_files_id_fk" FOREIGN KEY ("image_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiographs" ADD CONSTRAINT "radiographs_report_file_id_files_id_fk" FOREIGN KEY ("report_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "consultations_consultation_code_unique" ON "consultations" USING btree ("consultation_code");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_invoice_number_unique" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE UNIQUE INDEX "lab_requests_lab_request_code_unique" ON "lab_requests" USING btree ("lab_request_code");--> statement-breakpoint
CREATE UNIQUE INDEX "prescriptions_consultation_id_unique" ON "prescriptions" USING btree ("consultation_id");--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "consultation_id";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "discount";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "tax";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "total";--> statement-breakpoint
ALTER TABLE "invoice_items" DROP COLUMN "amount";--> statement-breakpoint
ALTER TABLE "lab_requests" DROP COLUMN "sent_date";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "transaction_reference";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "paid_at";--> statement-breakpoint
ALTER TABLE "radiographs" DROP COLUMN "image_url";