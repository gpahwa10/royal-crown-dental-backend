ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "consulted_at" timestamp;
UPDATE "consultations" SET "consulted_at" = "created_at" WHERE "consulted_at" IS NULL;
ALTER TABLE "consultations" ALTER COLUMN "consulted_at" SET DEFAULT now();
ALTER TABLE "consultations" ALTER COLUMN "consulted_at" SET NOT NULL;
