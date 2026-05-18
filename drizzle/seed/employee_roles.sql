INSERT INTO "employeeRoles" (name) VALUES
  ('Doctor'),
  ('Assistant'),
  ('HR Head'),
  ('HR Assistant'),
  ('Lab Technician'),
  ('Phlebotomist'),
  ('Reception'),
  ('Super Admin'),
  ('Director')
ON CONFLICT (name) DO NOTHING;
