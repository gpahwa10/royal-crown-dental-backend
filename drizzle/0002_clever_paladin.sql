ALTER TYPE "public"."payment_method" ADD VALUE 'mpesa';--> statement-breakpoint
ALTER TABLE "inventory_location" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inventory_transaction" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "inventory_location" CASCADE;--> statement-breakpoint
DROP TABLE "inventory_transaction" CASCADE;--> statement-breakpoint
ALTER TABLE "odontogram_changes" DROP CONSTRAINT "odontogram_changes_created_by_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "inventory_stock" DROP CONSTRAINT "inventory_stock_location_id_inventory_location_id_fk";
--> statement-breakpoint
DROP INDEX "inventory_location_variant_unique";--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "doctor_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory_stock" ADD COLUMN "clinic_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_doctor_id_employees_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_patient_id_idx" ON "appointments" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "appointments_clinic_id_idx" ON "appointments" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "appointments_scheduled_at_idx" ON "appointments" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "consultations_patient_id_idx" ON "consultations" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "consultations_clinic_id_idx" ON "consultations" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "consultations_doctor_id_idx" ON "consultations" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "consultations_patient_created_at_idx" ON "consultations" USING btree ("patient_id","created_at");--> statement-breakpoint
CREATE INDEX "prescriptions_patient_id_idx" ON "prescriptions" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "prescription_items_prescription_id_idx" ON "prescription_items" USING btree ("prescription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_clinic_variant_unique" ON "inventory_stock" USING btree ("variant_id","clinic_id");--> statement-breakpoint
ALTER TABLE "service_catalog" DROP COLUMN "tax_percentage";--> statement-breakpoint
ALTER TABLE "service_catalog" DROP COLUMN "is_taxable";--> statement-breakpoint
ALTER TABLE "inventory_stock" DROP COLUMN "location_id";