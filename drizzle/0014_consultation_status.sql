CREATE TYPE "public"."consultation_status" AS ENUM('draft', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
ALTER TABLE "consultations" ADD COLUMN "status" "consultation_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "consultations_consultation_code_unique" ON "consultations" USING btree ("consultation_code");--> statement-breakpoint
ALTER TABLE "prescriptions" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "prescription_items" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "prescriptions_consultation_id_unique" ON "prescriptions" USING btree ("consultation_id");
