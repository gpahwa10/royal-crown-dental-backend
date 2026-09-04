import {
    pgTable,
    uuid,
    integer,
    timestamp,
    uniqueIndex,
} from "drizzle-orm/pg-core";

import { clinics } from "./clinic";
import { inventoryVariant } from "./inventoryVariants";

export const inventoryStock = pgTable(
    "inventory_stock",
    {
        id: uuid("id").primaryKey().defaultRandom(),

        variantId: uuid("variant_id")
            .references(() => inventoryVariant.id, {
                onDelete: "cascade",
            })
            .notNull(),

        clinicId: uuid("clinic_id")
            .references(() => clinics.id, {
                onDelete: "cascade",
            })
            .notNull(),

        inStock: integer("in_stock").notNull().default(0),

        reservedStock: integer("reserved_stock").notNull().default(0),

        requiredStock: integer("required_stock").notNull().default(0),

        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
        inventoryClinicVariantUnique: uniqueIndex(
            "inventory_clinic_variant_unique"
        ).on(table.variantId, table.clinicId),
    })
);
