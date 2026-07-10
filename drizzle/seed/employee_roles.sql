INSERT INTO "employeeRoles" (name) VALUES
  ('Doctor'),
  ('Clinic Head'),
  ('Reception'),
  ('Assistant'),
  ('Helper'),
  ('Lab Technician'),
  ('Phlebotomist'),
  ('Inventory Manager'),
  ('HR Head'),
  ('HR Assistant'),
  ('Super Admin'),
  ('Director')
ON CONFLICT (name) DO NOTHING;
