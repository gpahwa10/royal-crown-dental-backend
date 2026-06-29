// inventory_item.ts

import {
    pgTable,
    uuid,
    varchar,
    text,
    timestamp,
    integer,
    boolean,
  } from "drizzle-orm/pg-core";
  
  import { inventoryCategory } from "./inventoryCategories";
  import { clinics } from "./clinic";
  
  export const inventoryItem = pgTable(
    "inventory_item",
    {
      id: uuid("id").primaryKey().defaultRandom(),
  
      categoryId: uuid("category_id")
        .references(() => inventoryCategory.id, {
          onDelete: "cascade",
        })
        .notNull(),

      clinicId: uuid("clinic_id").references(() => clinics.id, {
        onDelete: "cascade",
      }),
  
      name: varchar("name", { length: 255 }).notNull(),
  
      sku: varchar("sku", { length: 100 }),
  
      unit: varchar("unit", { length: 50 }),
  
      minimumStockLevel: integer("minimum_stock_level")
        .default(0)
        .notNull(),
  
      description: text("description"),

      isActive: boolean("is_active").default(true).notNull(),
  
      createdAt: timestamp("created_at")
        .defaultNow()
        .notNull(),
  
      updatedAt: timestamp("updated_at")
        .defaultNow()
        .notNull(),
    }
  );