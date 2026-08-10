CREATE TABLE "clinic_working_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"open_time" varchar(8),
	"close_time" varchar(8),
	"is_closed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clinic_working_hours_clinic_id_day_of_week_unique" UNIQUE("clinic_id","day_of_week")
);
--> statement-breakpoint
CREATE TABLE "employee_working_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" varchar(8),
	"end_time" varchar(8),
	"is_off" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employee_working_hours_employee_id_day_of_week_unique" UNIQUE("employee_id","day_of_week")
);
--> statement-breakpoint
CREATE TABLE "prescription_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"prescription_id" uuid NOT NULL,
	"bucket" text NOT NULL,
	"s3_key" text NOT NULL,
	"original_file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" bigint NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prescription_share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"file_id" uuid NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "must_change_password" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "super_admins" ADD COLUMN "must_change_password" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "clinic_working_hours" ADD CONSTRAINT "clinic_working_hours_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_working_hours" ADD CONSTRAINT "employee_working_hours_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescription_files" ADD CONSTRAINT "prescription_files_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescription_files" ADD CONSTRAINT "prescription_files_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescription_files" ADD CONSTRAINT "prescription_files_prescription_id_prescriptions_id_fk" FOREIGN KEY ("prescription_id") REFERENCES "public"."prescriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescription_files" ADD CONSTRAINT "prescription_files_uploaded_by_employees_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescription_share_links" ADD CONSTRAINT "prescription_share_links_file_id_prescription_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."prescription_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescription_share_links" ADD CONSTRAINT "prescription_share_links_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "prescription_files_prescription_id_unique" ON "prescription_files" USING btree ("prescription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prescription_files_s3_key_unique" ON "prescription_files" USING btree ("s3_key");--> statement-breakpoint
CREATE UNIQUE INDEX "prescription_share_links_token_unique" ON "prescription_share_links" USING btree ("token");