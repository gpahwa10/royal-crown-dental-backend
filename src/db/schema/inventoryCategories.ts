// inventory_category.ts

import {
    pgTable,
    uuid,
    varchar,
    text,
    timestamp,
    boolean,
    uniqueIndex,
  } from "drizzle-orm/pg-core";
  
  export const inventoryCategory = pgTable(
    "inventory_category",
    {
      id: uuid("id").primaryKey().defaultRandom(),
  
      name: varchar("name", { length: 255 }).notNull(),
  
      description: text("description"),
  
      parentCategoryId: uuid("parent_category_id"),

      isActive: boolean("is_active").default(true).notNull(),
  
      createdAt: timestamp("created_at")
        .defaultNow()
        .notNull(),
  
      updatedAt: timestamp("updated_at")
        .defaultNow()
        .notNull(),
    },
    (table) => ({
      categoryNameUnique: uniqueIndex(
        "inventory_category_name_unique"
      ).on(table.name),
    })
  );