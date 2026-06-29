UPDATE "lab_requests" SET "status" = 'under_examination' WHERE "status" = 'sent_to_lab';--> statement-breakpoint
ALTER TYPE "public"."lab_request_status" RENAME TO "lab_request_status_old";--> statement-breakpoint
CREATE TYPE "public"."lab_request_status" AS ENUM('sample_collected', 'under_examination', 'delivered');--> statement-breakpoint
ALTER TABLE "lab_requests" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "lab_requests" ALTER COLUMN "status" TYPE "public"."lab_request_status" USING "status"::text::"public"."lab_request_status";--> statement-breakpoint
ALTER TABLE "lab_requests" ALTER COLUMN "status" SET DEFAULT 'sample_collected';--> statement-breakpoint
DROP TYPE "public"."lab_request_status_old";--> statement-breakpoint
ALTER TABLE "lab_requests" ADD COLUMN "lab_request_code" varchar(50);--> statement-breakpoint
WITH "numbered" AS (
	SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at") AS "rn"
	FROM "lab_requests"
)
UPDATE "lab_requests" AS "lr"
SET "lab_request_code" = 'LAB' || LPAD("numbered"."rn"::text, 6, '0')
FROM "numbered"
WHERE "lr"."id" = "numbered"."id" AND "lr"."lab_request_code" IS NULL;--> statement-breakpoint
ALTER TABLE "lab_requests" ALTER COLUMN "lab_request_code" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "lab_requests_lab_request_code_unique" ON "lab_requests" USING btree ("lab_request_code");--> statement-breakpoint
ALTER TABLE "lab_requests" ALTER COLUMN "consultation_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "lab_requests" DROP COLUMN "sent_date";--> statement-breakpoint
ALTER TABLE "lab_requests" ADD COLUMN "collected_date" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "lab_requests" ADD COLUMN "under_examination_date" timestamp;--> statement-breakpoint
ALTER TABLE "lab_requests" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "lab_reports" ADD COLUMN "report_name" text;--> statement-breakpoint
UPDATE "lab_reports" SET "report_name" = 'Report.pdf' WHERE "report_name" IS NULL;--> statement-breakpoint
ALTER TABLE "lab_reports" ALTER COLUMN "report_name" SET NOT NULL;
