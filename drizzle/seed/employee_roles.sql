INSERT INTO "employeeRoles" (name) VALUES
  ('Doctor'),
  ('Clinic Head'),
  ('FDE'),
  ('Assistant'),
  ('Helper'),
  ('Lab Technician'),
  ('Phlebotomist'),
  ('Inventory Manager'),
  ('HR Head'),
  ('HR Assistant'),
  ('Super Admin'),
  ('Director'),
  ('Retail Head')
ON CONFLICT (name) DO NOTHING;
