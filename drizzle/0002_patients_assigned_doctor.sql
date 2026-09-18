ALTER TABLE "patients"
ADD COLUMN "doctor_id" uuid;
--> statement-breakpoint

ALTER TABLE "patients"
ADD CONSTRAINT "patients_doctor_id_employees_id_fk"
FOREIGN KEY ("doctor_id") REFERENCES "public"."employees"("id")
ON DELETE set null ON UPDATE no action;
