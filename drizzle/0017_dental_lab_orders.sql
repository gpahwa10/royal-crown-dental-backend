CREATE TYPE "public"."dental_lab_order_status" AS ENUM('ordered', 'delivered', 'cementation_done');--> statement-breakpoint
CREATE TYPE "public"."appointment_type" AS ENUM('general', 'consultation', 'treatment', 'follow_up');--> statement-breakpoint
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
CREATE TABLE "dental_lab_order_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dental_lab_order_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "appointment_type" "appointment_type" DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "dental_lab_order_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "dental_lab_orders_order_code_unique" ON "dental_lab_orders" USING btree ("order_code");--> statement-breakpoint
CREATE UNIQUE INDEX "dental_lab_order_files_order_file_unique" ON "dental_lab_order_files" USING btree ("dental_lab_order_id","file_id");--> statement-breakpoint
ALTER TABLE "dental_lab_orders" ADD CONSTRAINT "dental_lab_orders_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_lab_orders" ADD CONSTRAINT "dental_lab_orders_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_lab_orders" ADD CONSTRAINT "dental_lab_orders_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_lab_orders" ADD CONSTRAINT "dental_lab_orders_measured_by_doctor_id_employees_id_fk" FOREIGN KEY ("measured_by_doctor_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_lab_orders" ADD CONSTRAINT "dental_lab_orders_cementation_doctor_id_employees_id_fk" FOREIGN KEY ("cementation_doctor_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_lab_orders" ADD CONSTRAINT "dental_lab_orders_cementation_appointment_id_appointments_id_fk" FOREIGN KEY ("cementation_appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_lab_order_files" ADD CONSTRAINT "dental_lab_order_files_dental_lab_order_id_dental_lab_orders_id_fk" FOREIGN KEY ("dental_lab_order_id") REFERENCES "public"."dental_lab_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_lab_order_files" ADD CONSTRAINT "dental_lab_order_files_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_dental_lab_order_id_dental_lab_orders_id_fk" FOREIGN KEY ("dental_lab_order_id") REFERENCES "public"."dental_lab_orders"("id") ON DELETE set null ON UPDATE no action;
