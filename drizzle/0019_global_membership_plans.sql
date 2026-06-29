ALTER TABLE "membership_plan_benefits" ADD COLUMN IF NOT EXISTS "service_code" varchar(50);--> statement-breakpoint
UPDATE "membership_plan_benefits" mpb
SET "service_code" = UPPER(sc."service_code")
FROM "service_catalog" sc
WHERE mpb."service_id" = sc."id" AND mpb."service_code" IS NULL;--> statement-breakpoint
ALTER TABLE "membership_plan_benefits" DROP CONSTRAINT IF EXISTS "membership_plan_benefits_service_id_service_catalog_id_fk";--> statement-breakpoint
ALTER TABLE "membership_plan_benefits" DROP COLUMN IF EXISTS "service_id";--> statement-breakpoint
ALTER TABLE "membership_plan_benefits" ALTER COLUMN "service_code" SET NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "membership_plans_clinic_code_unique";--> statement-breakpoint
ALTER TABLE "membership_plans" DROP CONSTRAINT IF EXISTS "membership_plans_clinic_id_clinics_id_fk";--> statement-breakpoint
ALTER TABLE "membership_plans" DROP COLUMN IF EXISTS "clinic_id";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "membership_plans_plan_code_unique" ON "membership_plans" USING btree ("plan_code");
