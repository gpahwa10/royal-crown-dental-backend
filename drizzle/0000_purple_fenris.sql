CREATE TYPE "public"."appointment_status" AS ENUM('scheduled', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."appointment_type" AS ENUM('general', 'consultation', 'treatment', 'follow_up');--> statement-breakpoint
CREATE TYPE "public"."clinic_visit_outcome" AS ENUM('enquiry_only', 'appointment_booked', 'patient_registered', 'consultation_completed', 'treatment_started', 'treatment_completed', 'billing_completed', 'membership_purchased', 'reports_collected', 'cancelled', 'left_without_consultation', 'referred', 'other');--> statement-breakpoint
CREATE TYPE "public"."clinic_visit_purpose" AS ENUM('consultation', 'treatment', 'follow_up', 'enquiry', 'emergency', 'billing', 'membership', 'report_collection', 'medicine_collection', 'document_submission', 'other');--> statement-breakpoint
CREATE TYPE "public"."clinic_visit_status" AS ENUM('checked_in', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."consultation_status" AS ENUM('draft', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."dental_lab_order_status" AS ENUM('ordered', 'delivered', 'cementation_done');--> statement-breakpoint
CREATE TYPE "public"."file_document_type" AS ENUM('lab_report', 'radiograph', 'prescription', 'invoice', 'consent', 'treatment', 'patient_document', 'other');--> statement-breakpoint
CREATE TYPE "public"."file_upload_status" AS ENUM('pending_upload', 'uploaded', 'archived');--> statement-breakpoint
CREATE TYPE "public"."password_reset_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."patient_type" AS ENUM('new', 'existing');--> statement-breakpoint
CREATE TYPE "public"."pregnancy_status" AS ENUM('Not Applicable', 'Pregnant', 'Not Pregnant');--> statement-breakpoint
CREATE TYPE "public"."dental_anxiety" AS ENUM('none', 'mild', 'moderate', 'severe');--> statement-breakpoint
CREATE TYPE "public"."lab_request_status" AS ENUM('sample_collected', 'under_examination', 'delivered');--> statement-breakpoint
CREATE TYPE "public"."radiograph_status" AS ENUM('scheduled', 'acquired', 'reported');--> statement-breakpoint
CREATE TYPE "public"."membership_discount_type" AS ENUM('percentage', 'fixed', 'free');--> statement-breakpoint
CREATE TYPE "public"."patient_membership_status" AS ENUM('pending_payment', 'active', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."invoice_source_type" AS ENUM('consultation', 'lab_request', 'radiograph', 'dental_lab', 'membership', 'manual');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'pending', 'partially_paid', 'paid', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'upi', 'card', 'finance', 'bank_transfer', 'cheque');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('call', 'whatsapp', 'website', 'walk_in', 'referral', 'qr_self');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new_query', 'follow_up', 'appointment_booked', 'clinic_visited', 'converted', 'closed_lost', 'no_show');--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_code" varchar(50) NOT NULL,
	"clinic_id" uuid NOT NULL,
	"employee_id" uuid,
	"patient_id" uuid,
	"lead_id" uuid,
	"appointment_type" "appointment_type" DEFAULT 'general' NOT NULL,
	"dental_lab_order_id" uuid,
	"scheduled_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"symptoms" text,
	"status" "appointment_status" DEFAULT 'scheduled',
	"checked_in_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_clinic_id" integer,
	"clinic_name" varchar(255) NOT NULL,
	"clinic_code" varchar(50) NOT NULL,
	"email" varchar(255),
	"phone" varchar(20),
	"address" text,
	"city" varchar(100),
	"state" varchar(100),
	"country" varchar(100),
	"pincode" varchar(20),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "clinics_legacy_clinic_id_unique" UNIQUE("legacy_clinic_id"),
	CONSTRAINT "clinics_clinic_code_unique" UNIQUE("clinic_code")
);
--> statement-breakpoint
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
CREATE TABLE "clinic_working_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"open_time" varchar(8),
	"close_time" varchar(8),
	"is_closed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clinic_working_hours_clinic_id_day_of_week_unique" UNIQUE("clinic_id","day_of_week")
);
--> statement-breakpoint
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
	"status" "consultation_status" DEFAULT 'draft' NOT NULL,
	"consent_required" boolean DEFAULT false NOT NULL,
	"consent_signed" boolean DEFAULT false NOT NULL,
	"consent_signature_url" text,
	"consent_signed_at" timestamp,
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
CREATE TABLE "employee_role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "employee_role_assignments_employee_role_unique" UNIQUE("employee_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "employee_working_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" varchar(8),
	"end_time" varchar(8),
	"is_off" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employee_working_hours_employee_id_day_of_week_unique" UNIQUE("employee_id","day_of_week")
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" integer,
	"clinic_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"phone" varchar(255) DEFAULT '' NOT NULL,
	"designation" varchar(255) NOT NULL,
	"timings" varchar(255),
	"is_blocked" boolean DEFAULT false NOT NULL,
	"is_suspended" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "employees_legacy_id_unique" UNIQUE("legacy_id"),
	CONSTRAINT "employees_email_unique" UNIQUE("email")
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
CREATE TABLE "password_reset_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"clinic_id" uuid,
	"note" text,
	"status" "password_reset_request_status" DEFAULT 'pending' NOT NULL,
	"resolved_at" timestamp,
	"resolved_by_id" uuid,
	"resolved_by_name" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employeeRoles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "employeeRoles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "super_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "super_admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_code" varchar(50) NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_type" "patient_type" DEFAULT 'new' NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"email" varchar(255),
	"gender" varchar(50) NOT NULL,
	"date_of_birth" timestamp NOT NULL,
	"address" text,
	"emergency_contact_name" varchar(255),
	"emergency_contact_phone" varchar(20),
	"emergency_contact_relation" varchar(100),
	"is_premium_member" boolean DEFAULT false NOT NULL,
	"is_black_listed" boolean DEFAULT false NOT NULL,
	"black_listed_reason" text,
	"last_visit_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "prescriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prescription_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prescription_id" uuid NOT NULL,
	"medicine_name" text NOT NULL,
	"dosage" text,
	"frequency" text,
	"duration" text,
	"instructions" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prescription_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"prescription_id" uuid NOT NULL,
	"bucket" text NOT NULL,
	"s3_key" text NOT NULL,
	"original_file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" bigint NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prescription_share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"file_id" uuid NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lab_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lab_request_code" varchar(50) NOT NULL,
	"consultation_id" uuid,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"clinic_id" uuid NOT NULL,
	"external_lab_name" text,
	"notes" text,
	"status" "lab_request_status" DEFAULT 'sample_collected' NOT NULL,
	"collected_date" timestamp DEFAULT now() NOT NULL,
	"under_examination_date" timestamp,
	"delivered_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lab_request_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lab_request_id" uuid NOT NULL,
	"test_name" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lab_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lab_request_id" uuid NOT NULL,
	"file_id" uuid,
	"report_name" text NOT NULL,
	"report_url" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
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
	"image_file_id" uuid,
	"report_file_id" uuid,
	"report_text" text,
	"status" "radiograph_status" DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" varchar(50) NOT NULL,
	"patient_id" uuid NOT NULL,
	"clinic_id" uuid NOT NULL,
	"source_type" "invoice_source_type" DEFAULT 'manual' NOT NULL,
	"source_id" uuid,
	"subtotal" integer NOT NULL,
	"membership_discount" integer DEFAULT 0 NOT NULL,
	"manual_discount" integer DEFAULT 0 NOT NULL,
	"tax_amount" integer DEFAULT 0 NOT NULL,
	"grand_total" integer NOT NULL,
	"amount_paid" integer DEFAULT 0 NOT NULL,
	"balance_amount" integer NOT NULL,
	"status" "invoice_status" DEFAULT 'pending' NOT NULL,
	"generated_by" uuid,
	"invoice_pdf_file_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"service_id" uuid,
	"service_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"discount_amount" integer DEFAULT 0 NOT NULL,
	"tax_percentage" integer DEFAULT 0 NOT NULL,
	"tax_amount" integer DEFAULT 0 NOT NULL,
	"line_total" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"payment_reference" text,
	"payment_date" timestamp DEFAULT now() NOT NULL,
	"received_by" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"parent_category_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"clinic_id" uuid,
	"name" varchar(255) NOT NULL,
	"sku" varchar(100),
	"unit" varchar(50),
	"minimum_stock_level" integer DEFAULT 0 NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_location" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"city" varchar(100),
	"address" varchar(500),
	"clinic_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"in_stock" integer DEFAULT 0 NOT NULL,
	"reserved_stock" integer DEFAULT 0 NOT NULL,
	"required_stock" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"from_location_id" uuid,
	"to_location_id" uuid,
	"quantity" integer NOT NULL,
	"transaction_type" varchar(50) NOT NULL,
	"reference_number" varchar(100),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_variant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"sku" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(20) NOT NULL,
	"source" "lead_source" NOT NULL,
	"status" "lead_status" DEFAULT 'new_query' NOT NULL,
	"symptoms" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "clinic_working_hours" ADD CONSTRAINT "clinic_working_hours_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_doctor_id_employees_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_lab_order_files" ADD CONSTRAINT "dental_lab_order_files_dental_lab_order_id_dental_lab_orders_id_fk" FOREIGN KEY ("dental_lab_order_id") REFERENCES "public"."dental_lab_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_lab_order_files" ADD CONSTRAINT "dental_lab_order_files_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_lab_orders" ADD CONSTRAINT "dental_lab_orders_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_lab_orders" ADD CONSTRAINT "dental_lab_orders_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_lab_orders" ADD CONSTRAINT "dental_lab_orders_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_lab_orders" ADD CONSTRAINT "dental_lab_orders_measured_by_doctor_id_employees_id_fk" FOREIGN KEY ("measured_by_doctor_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_lab_orders" ADD CONSTRAINT "dental_lab_orders_cementation_doctor_id_employees_id_fk" FOREIGN KEY ("cementation_doctor_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_lab_orders" ADD CONSTRAINT "dental_lab_orders_cementation_appointment_id_appointments_id_fk" FOREIGN KEY ("cementation_appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_role_assignments" ADD CONSTRAINT "employee_role_assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_role_assignments" ADD CONSTRAINT "employee_role_assignments_role_id_employeeRoles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."employeeRoles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_working_hours" ADD CONSTRAINT "employee_working_hours_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_employees_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_requests" ADD CONSTRAINT "password_reset_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_requests" ADD CONSTRAINT "password_reset_requests_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_medical_profiles" ADD CONSTRAINT "patient_medical_profiles_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_consents" ADD CONSTRAINT "patient_consents_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_doctor_id_employees_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescription_id_prescriptions_id_fk" FOREIGN KEY ("prescription_id") REFERENCES "public"."prescriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescription_files" ADD CONSTRAINT "prescription_files_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescription_files" ADD CONSTRAINT "prescription_files_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescription_files" ADD CONSTRAINT "prescription_files_prescription_id_prescriptions_id_fk" FOREIGN KEY ("prescription_id") REFERENCES "public"."prescriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescription_files" ADD CONSTRAINT "prescription_files_uploaded_by_employees_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescription_share_links" ADD CONSTRAINT "prescription_share_links_file_id_prescription_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."prescription_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescription_share_links" ADD CONSTRAINT "prescription_share_links_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_requests" ADD CONSTRAINT "lab_requests_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_requests" ADD CONSTRAINT "lab_requests_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_requests" ADD CONSTRAINT "lab_requests_doctor_id_employees_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_requests" ADD CONSTRAINT "lab_requests_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_request_tests" ADD CONSTRAINT "lab_request_tests_lab_request_id_lab_requests_id_fk" FOREIGN KEY ("lab_request_id") REFERENCES "public"."lab_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_lab_request_id_lab_requests_id_fk" FOREIGN KEY ("lab_request_id") REFERENCES "public"."lab_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiographs" ADD CONSTRAINT "radiographs_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiographs" ADD CONSTRAINT "radiographs_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiographs" ADD CONSTRAINT "radiographs_doctor_id_employees_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiographs" ADD CONSTRAINT "radiographs_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiographs" ADD CONSTRAINT "radiographs_image_file_id_files_id_fk" FOREIGN KEY ("image_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radiographs" ADD CONSTRAINT "radiographs_report_file_id_files_id_fk" FOREIGN KEY ("report_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_catalog" ADD CONSTRAINT "service_catalog_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_plan_benefits" ADD CONSTRAINT "membership_plan_benefits_membership_plan_id_membership_plans_id_fk" FOREIGN KEY ("membership_plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_memberships" ADD CONSTRAINT "patient_memberships_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_memberships" ADD CONSTRAINT "patient_memberships_membership_plan_id_membership_plans_id_fk" FOREIGN KEY ("membership_plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_memberships" ADD CONSTRAINT "patient_memberships_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_memberships" ADD CONSTRAINT "patient_memberships_purchased_by_employees_id_fk" FOREIGN KEY ("purchased_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_generated_by_employees_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_invoice_pdf_file_id_files_id_fk" FOREIGN KEY ("invoice_pdf_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_service_id_service_catalog_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."service_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_employees_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_category_id_inventory_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."inventory_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_location" ADD CONSTRAINT "inventory_location_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_variant_id_inventory_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."inventory_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_location_id_inventory_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."inventory_location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transaction" ADD CONSTRAINT "inventory_transaction_variant_id_inventory_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."inventory_variant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transaction" ADD CONSTRAINT "inventory_transaction_from_location_id_inventory_location_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "public"."inventory_location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transaction" ADD CONSTRAINT "inventory_transaction_to_location_id_inventory_location_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "public"."inventory_location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_variant" ADD CONSTRAINT "inventory_variant_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clinic_visit_files_visit_file_unique" ON "clinic_visit_files" USING btree ("clinic_visit_id","file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clinic_visits_visit_number_unique" ON "clinic_visits" USING btree ("visit_number");--> statement-breakpoint
CREATE UNIQUE INDEX "consultations_consultation_code_unique" ON "consultations" USING btree ("consultation_code");--> statement-breakpoint
CREATE UNIQUE INDEX "dental_lab_order_files_order_file_unique" ON "dental_lab_order_files" USING btree ("dental_lab_order_id","file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dental_lab_orders_order_code_unique" ON "dental_lab_orders" USING btree ("order_code");--> statement-breakpoint
CREATE UNIQUE INDEX "files_object_key_unique" ON "files" USING btree ("object_key");--> statement-breakpoint
CREATE UNIQUE INDEX "patients_patient_code_unique" ON "patients" USING btree ("patient_code");--> statement-breakpoint
CREATE UNIQUE INDEX "patient_medical_profiles_patient_id_unique" ON "patient_medical_profiles" USING btree ("patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "patient_consents_patient_id_unique" ON "patient_consents" USING btree ("patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prescriptions_consultation_id_unique" ON "prescriptions" USING btree ("consultation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prescription_files_prescription_id_unique" ON "prescription_files" USING btree ("prescription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prescription_files_s3_key_unique" ON "prescription_files" USING btree ("s3_key");--> statement-breakpoint
CREATE UNIQUE INDEX "prescription_share_links_token_unique" ON "prescription_share_links" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "lab_requests_lab_request_code_unique" ON "lab_requests" USING btree ("lab_request_code");--> statement-breakpoint
CREATE UNIQUE INDEX "service_catalog_clinic_code_unique" ON "service_catalog" USING btree ("clinic_id","service_code");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_plans_plan_code_unique" ON "membership_plans" USING btree ("plan_code");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_invoice_number_unique" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_category_name_unique" ON "inventory_category" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_location_variant_unique" ON "inventory_stock" USING btree ("variant_id","location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_variant_unique" ON "inventory_variant" USING btree ("inventory_item_id","name");