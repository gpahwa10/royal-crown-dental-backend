CREATE TABLE "employee_role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "employee_role_assignments_employee_role_unique" UNIQUE("employee_id","role_id")
);
--> statement-breakpoint
ALTER TABLE "clinics" ADD COLUMN "legacy_clinic_id" integer;--> statement-breakpoint
ALTER TABLE "clinics" ADD CONSTRAINT "clinics_legacy_clinic_id_unique" UNIQUE("legacy_clinic_id");--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "timings" varchar(255);--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_legacy_id_unique" UNIQUE("legacy_id");--> statement-breakpoint
INSERT INTO "employee_role_assignments" ("employee_id", "role_id")
SELECT e."id", e."role_id"
FROM "employees" e
WHERE e."role_id" IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
ALTER TABLE "employees" DROP CONSTRAINT "employees_role_id_employeeRoles_id_fk";
--> statement-breakpoint
ALTER TABLE "employees" DROP COLUMN "role_id";
--> statement-breakpoint
ALTER TABLE "employee_role_assignments" ADD CONSTRAINT "employee_role_assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_role_assignments" ADD CONSTRAINT "employee_role_assignments_role_id_employeeRoles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."employeeRoles"("id") ON DELETE cascade ON UPDATE no action;
