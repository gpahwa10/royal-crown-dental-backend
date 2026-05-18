INSERT INTO "employeeRoles" (name) VALUES
  ('Doctor'),
  ('Assistant'),
  ('HR Head'),
  ('HR Assistant'),
  ('Lab Technician'),
  ('Phlebotomist'),
  ('Reception')
ON CONFLICT (name) DO NOTHING;
