DO $$ BEGIN
    CREATE TYPE password_reset_request_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS password_reset_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL,
    note TEXT,
    status password_reset_request_status NOT NULL DEFAULT 'pending',
    resolved_at TIMESTAMP,
    resolved_by_id UUID,
    resolved_by_name VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS password_reset_requests_status_idx ON password_reset_requests (status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS password_reset_requests_employee_id_idx ON password_reset_requests (employee_id);
