// inventory_stock.ts

import {
    pgTable,
    uuid,
    integer,
    timestamp,
    uniqueIndex,
  } from "drizzle-orm/pg-core";
  
  import { inventoryVariant } from "./inventoryVariants";
  import { inventoryLocation } from "./inventoryLocations";
  
  export const inventoryStock = pgTable(
    "inventory_stock",
    {
      id: uuid("id").primaryKey().defaultRandom(),
  
      variantId: uuid("variant_id")
        .references(() => inventoryVariant.id, {
          onDelete: "cascade",
        })
        .notNull(),
  
      locationId: uuid("location_id")
        .references(() => inventoryLocation.id, {
          onDelete: "cascade",
        })
        .notNull(),
  
      inStock: integer("in_stock")
        .notNull()
        .default(0),
  
      reservedStock: integer("reserved_stock")
        .notNull()
        .default(0),
  
      requiredStock: integer("required_stock")
        .notNull()
        .default(0),
  
      updatedAt: timestamp("updated_at")
        .defaultNow()
        .notNull(),
    },
    (table) => ({
      inventoryLocationVariantUnique: uniqueIndex(
        "inventory_location_variant_unique"
      ).on(table.variantId, table.locationId),
    })
  );