-- Clinic and employee weekly working hours.
CREATE TABLE IF NOT EXISTS clinic_working_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time VARCHAR(8),
  close_time VARCHAR(8),
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (clinic_id, day_of_week),
  CHECK (
    is_closed = TRUE
    OR (open_time IS NOT NULL AND close_time IS NOT NULL AND open_time < close_time)
  )
);

CREATE TABLE IF NOT EXISTS employee_working_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time VARCHAR(8),
  end_time VARCHAR(8),
  is_off BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, day_of_week),
  CHECK (
    is_off = TRUE
    OR (start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)
  )
);

CREATE INDEX IF NOT EXISTS clinic_working_hours_clinic_id_idx
  ON clinic_working_hours (clinic_id);
CREATE INDEX IF NOT EXISTS employee_working_hours_employee_id_idx
  ON employee_working_hours (employee_id);
