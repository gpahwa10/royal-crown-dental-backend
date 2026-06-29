ALTER TABLE "inventory_item" ADD COLUMN "clinic_id" uuid;
--> statement-breakpoint
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
DROP INDEX IF EXISTS "inventory_item_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_item_clinic_unique" ON "inventory_item" USING btree ("clinic_id","category_id","name") WHERE "clinic_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_item_global_unique" ON "inventory_item" USING btree ("category_id","name") WHERE "clinic_id" IS NULL;
