// inventory_location.ts

import {
    pgTable,
    uuid,
    varchar,
    timestamp,
    boolean,
  } from "drizzle-orm/pg-core";

  import { clinics } from "./clinic";
  
  export const inventoryLocation = pgTable(
    "inventory_location",
    {
      id: uuid("id").primaryKey().defaultRandom(),
  
      name: varchar("name", { length: 255 }).notNull(),
  
      type: varchar("type", { length: 50 }).notNull(),
      // clinic | warehouse
  
      city: varchar("city", { length: 100 }),
  
      address: varchar("address", { length: 500 }),

      clinicId: uuid("clinic_id").references(() => clinics.id, {
        onDelete: "set null",
      }),

      isActive: boolean("is_active").default(true).notNull(),
  
      createdAt: timestamp("created_at")
        .defaultNow()
        .notNull(),
  
      updatedAt: timestamp("updated_at")
        .defaultNow()
        .notNull(),
    }
  );