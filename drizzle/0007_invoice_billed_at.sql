ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "billed_at" timestamp;
UPDATE "invoices" SET "billed_at" = "created_at" WHERE "billed_at" IS NULL;
ALTER TABLE "invoices" ALTER COLUMN "billed_at" SET DEFAULT now();
ALTER TABLE "invoices" ALTER COLUMN "billed_at" SET NOT NULL;
