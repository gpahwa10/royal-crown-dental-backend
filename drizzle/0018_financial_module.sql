CREATE TYPE "public"."membership_discount_type" AS ENUM('percentage', 'fixed', 'free');--> statement-breakpoint
CREATE TYPE "public"."patient_membership_status" AS ENUM('pending_payment', 'active', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."invoice_source_type" AS ENUM('consultation', 'lab_request', 'radiograph', 'dental_lab', 'membership', 'manual');--> statement-breakpoint
ALTER TYPE "public"."invoice_status" RENAME TO "invoice_status_old";--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'pending', 'partially_paid', 'paid', 'cancelled', 'refunded');--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "status" TYPE "public"."invoice_status" USING (
  CASE "status"::text
    WHEN 'draft' THEN 'draft'::"public"."invoice_status"
    WHEN 'paid' THEN 'paid'::"public"."invoice_status"
    WHEN 'partially_paid' THEN 'partially_paid'::"public"."invoice_status"
    WHEN 'cancelled' THEN 'cancelled'::"public"."invoice_status"
    ELSE 'pending'::"public"."invoice_status"
  END
);--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
DROP TYPE "public"."invoice_status_old";--> statement-breakpoint
ALTER TYPE "public"."payment_method" RENAME TO "payment_method_old";--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'upi', 'card', 'finance', 'bank_transfer', 'cheque');--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "payment_method" TYPE "public"."payment_method" USING "payment_method"::text::"public"."payment_method";--> statement-breakpoint
DROP TYPE "public"."payment_method_old";--> statement-breakpoint
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
INSERT INTO "service_catalog" ("id", "service_code", "service_name", "category", "default_price", "tax_percentage", "is_taxable", "is_active", "clinic_id", "created_at", "updated_at")
SELECT
	"id",
	COALESCE(UPPER(REPLACE("name", ' ', '_')), 'SERVICE_' || SUBSTRING("id"::text, 1, 8)),
	"name",
	"category",
	"price",
	0,
	true,
	"is_active",
	"clinic_id",
	"created_at",
	now()
FROM "services"
WHERE "clinic_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "service_catalog_clinic_code_unique" ON "service_catalog" USING btree ("clinic_id","service_code");--> statement-breakpoint
ALTER TABLE "service_catalog" ADD CONSTRAINT "service_catalog_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "membership_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_code" varchar(50) NOT NULL,
	"plan_name" text NOT NULL,
	"description" text,
	"price" integer NOT NULL,
	"validity_days" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"clinic_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "membership_plans_clinic_code_unique" ON "membership_plans" USING btree ("clinic_id","plan_code");--> statement-breakpoint
ALTER TABLE "membership_plans" ADD CONSTRAINT "membership_plans_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "membership_plan_benefits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_plan_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"discount_type" "membership_discount_type" NOT NULL,
	"discount_value" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "membership_plan_benefits" ADD CONSTRAINT "membership_plan_benefits_membership_plan_id_membership_plans_id_fk" FOREIGN KEY ("membership_plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_plan_benefits" ADD CONSTRAINT "membership_plan_benefits_service_id_service_catalog_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."service_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" DROP CONSTRAINT "invoice_items_service_id_services_id_fk";--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_consultation_id_consultations_id_fk";--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "source_type" "invoice_source_type" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "source_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "membership_discount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "manual_discount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "tax_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "grand_total" integer;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "amount_paid" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "balance_amount" integer;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "generated_by" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "invoice_pdf_file_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "invoices" SET "grand_total" = "total", "balance_amount" = "total" - COALESCE((SELECT SUM("amount") FROM "payments" WHERE "payments"."invoice_id" = "invoices"."id"), 0), "tax_amount" = "tax", "manual_discount" = "discount", "membership_discount" = 0 WHERE "grand_total" IS NULL;--> statement-breakpoint
UPDATE "invoices" SET "source_type" = 'consultation', "source_id" = "consultation_id" WHERE "consultation_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "grand_total" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "balance_amount" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "consultation_id";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "discount";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "tax";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "total";--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "service_name" text;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "discount_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "tax_percentage" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "tax_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "line_total" integer;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "invoice_items" SET "service_name" = COALESCE((SELECT "name" FROM "services" WHERE "services"."id" = "invoice_items"."service_id"), 'Service'), "line_total" = "amount", "tax_amount" = 0, "tax_percentage" = 0, "discount_amount" = 0 WHERE "line_total" IS NULL;--> statement-breakpoint
ALTER TABLE "invoice_items" ALTER COLUMN "service_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_items" ALTER COLUMN "line_total" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_items" DROP COLUMN "amount";--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_service_id_service_catalog_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."service_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "payment_date" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "received_by" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "payments" SET "payment_date" = "paid_at" WHERE "payment_date" IS NULL;--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "paid_at";--> statement-breakpoint
ALTER TABLE "payments" RENAME COLUMN "transaction_reference" TO "payment_reference";--> statement-breakpoint
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
ALTER TABLE "patient_memberships" ADD CONSTRAINT "patient_memberships_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_memberships" ADD CONSTRAINT "patient_memberships_membership_plan_id_membership_plans_id_fk" FOREIGN KEY ("membership_plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_memberships" ADD CONSTRAINT "patient_memberships_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_memberships" ADD CONSTRAINT "patient_memberships_purchased_by_employees_id_fk" FOREIGN KEY ("purchased_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_generated_by_employees_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_invoice_pdf_file_id_files_id_fk" FOREIGN KEY ("invoice_pdf_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_employees_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
DROP TABLE "services";
