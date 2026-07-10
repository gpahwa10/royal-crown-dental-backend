INSERT INTO "employeeRoles" (name) VALUES
  ('Clinic Head'),
  ('Helper'),
  ('Inventory Manager')
ON CONFLICT (name) DO NOTHING;

UPDATE "employeeRoles"
SET name = 'Inventory Manager', updated_at = NOW()
WHERE name = 'Inventory manager';
