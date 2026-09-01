CREATE TABLE "consultation_odontograms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"clinic_id" uuid NOT NULL,
	"status_chart" jsonb NOT NULL,
	"plan_chart" jsonb,
	"chart_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_odontograms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"clinic_id" uuid NOT NULL,
	"status_chart" jsonb NOT NULL,
	"plan_chart" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "odontogram_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"clinic_id" uuid NOT NULL,
	"consultation_id" uuid NOT NULL,
	"tooth_number" varchar(20),
	"change_type" varchar(50) NOT NULL,
	"previous_state" jsonb,
	"new_state" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_catalog" ALTER COLUMN "is_taxable" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "consultation_odontograms" ADD CONSTRAINT "consultation_odontograms_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_odontograms" ADD CONSTRAINT "consultation_odontograms_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_odontograms" ADD CONSTRAINT "consultation_odontograms_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_odontograms" ADD CONSTRAINT "patient_odontograms_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_odontograms" ADD CONSTRAINT "patient_odontograms_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontogram_changes" ADD CONSTRAINT "odontogram_changes_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontogram_changes" ADD CONSTRAINT "odontogram_changes_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontogram_changes" ADD CONSTRAINT "odontogram_changes_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "consultation_odontograms_consultation_unique" ON "consultation_odontograms" USING btree ("consultation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "patient_odontograms_patient_clinic_unique" ON "patient_odontograms" USING btree ("patient_id","clinic_id");--> statement-breakpoint
CREATE INDEX "odontogram_changes_consultation_id_idx" ON "odontogram_changes" USING btree ("consultation_id");--> statement-breakpoint
CREATE INDEX "odontogram_changes_patient_created_at_idx" ON "odontogram_changes" USING btree ("patient_id","created_at");--> statement-breakpoint
ALTER TABLE "service_catalog" DROP COLUMN "default_price";