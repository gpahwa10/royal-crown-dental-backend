CREATE TABLE "employeeRoles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "employeeRoles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "roles" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "roles" CASCADE;--> statement-breakpoint
ALTER TABLE "employees" DROP CONSTRAINT "employees_role_id_roles_id_fk";
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "password" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_role_id_employeeRoles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."employeeRoles"("id") ON DELETE no action ON UPDATE no action;