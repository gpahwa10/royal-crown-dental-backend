
import {
    pgTable,
    uuid,
    varchar,
    timestamp,
    boolean,
    uniqueIndex,
  } from "drizzle-orm/pg-core";
  
  import { inventoryItem } from "./inventoryItems";
  
  export const inventoryVariant = pgTable(
    "inventory_variant",
    {
      id: uuid("id").primaryKey().defaultRandom(),
  
      inventoryItemId: uuid("inventory_item_id")
        .references(() => inventoryItem.id, {
          onDelete: "cascade",
        })
        .notNull(),
  
      name: varchar("name", { length: 255 }).notNull(),
  
      sku: varchar("sku", { length: 100 }),

      isActive: boolean("is_active").default(true).notNull(),
  
      createdAt: timestamp("created_at")
        .defaultNow()
        .notNull(),
  
      updatedAt: timestamp("updated_at")
        .defaultNow()
        .notNull(),
    },
    (table) => ({
      variantUnique: uniqueIndex(
        "inventory_variant_unique"
      ).on(table.inventoryItemId, table.name),
    })
  );