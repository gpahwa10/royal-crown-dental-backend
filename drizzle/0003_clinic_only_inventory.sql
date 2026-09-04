ALTER TABLE "inventory_stock" ADD COLUMN IF NOT EXISTS "clinic_id" uuid;

-- Backfill clinic_id from clinic locations where possible
UPDATE "inventory_stock" AS s
SET "clinic_id" = l."clinic_id"
FROM "inventory_location" AS l
WHERE s."location_id" = l."id"
  AND l."type" = 'clinic'
  AND l."clinic_id" IS NOT NULL
  AND s."clinic_id" IS NULL;

-- Aggregate remaining warehouse/orphan rows onto the first active clinic when needed
DO $$
DECLARE
  fallback_clinic uuid;
BEGIN
  SELECT id INTO fallback_clinic FROM clinics WHERE is_active = true ORDER BY created_at LIMIT 1;
  IF fallback_clinic IS NOT NULL THEN
    UPDATE inventory_stock
    SET clinic_id = fallback_clinic
    WHERE clinic_id IS NULL;
  END IF;
END $$;

DELETE FROM "inventory_stock" WHERE "clinic_id" IS NULL;

ALTER TABLE "inventory_stock" ALTER COLUMN "clinic_id" SET NOT NULL;

ALTER TABLE "inventory_stock" DROP CONSTRAINT IF EXISTS "inventory_stock_location_id_inventory_location_id_fk";
ALTER TABLE "inventory_stock" DROP CONSTRAINT IF EXISTS "inventory_stock_clinic_id_clinics_id_fk";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_stock_clinic_id_clinics_id_fk'
  ) THEN
    ALTER TABLE "inventory_stock"
      ADD CONSTRAINT "inventory_stock_clinic_id_clinics_id_fk"
      FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE;
  END IF;
END $$;

DROP INDEX IF EXISTS "inventory_location_variant_unique";

-- Collapse duplicate (variant, clinic) rows before unique index
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY variant_id, clinic_id
      ORDER BY updated_at DESC, id
    ) AS rn,
    SUM(in_stock) OVER (PARTITION BY variant_id, clinic_id) AS total_in,
    SUM(reserved_stock) OVER (PARTITION BY variant_id, clinic_id) AS total_reserved,
    MAX(required_stock) OVER (PARTITION BY variant_id, clinic_id) AS max_required
  FROM inventory_stock
)
UPDATE inventory_stock AS s
SET
  in_stock = ranked.total_in,
  reserved_stock = ranked.total_reserved,
  required_stock = ranked.max_required
FROM ranked
WHERE s.id = ranked.id AND ranked.rn = 1;

DELETE FROM inventory_stock
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY variant_id, clinic_id
        ORDER BY updated_at DESC, id
      ) AS rn
    FROM inventory_stock
  ) d
  WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_clinic_variant_unique"
  ON "inventory_stock" ("variant_id", "clinic_id");

ALTER TABLE "inventory_stock" DROP COLUMN IF EXISTS "location_id";

DROP TABLE IF EXISTS "inventory_transaction";
DROP TABLE IF EXISTS "inventory_location";
