// inventory_transaction.ts

import {
  pgTable,
  uuid,
  integer,
  varchar,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { inventoryVariant } from "./inventoryVariants";
import { inventoryLocation } from "./inventoryLocations";

export const inventoryTransaction = pgTable(
  "inventory_transaction",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    variantId: uuid("variant_id")
      .references(() => inventoryVariant.id)
      .notNull(),

    fromLocationId: uuid("from_location_id")
      .references(() => inventoryLocation.id),

    toLocationId: uuid("to_location_id")
      .references(() => inventoryLocation.id),

    quantity: integer("quantity")
      .notNull(),

    transactionType: varchar("transaction_type", {
      length: 50,
    }).notNull(),
    /*
      purchase
      transfer
      usage
      adjustment
      damaged
      expired
      return
    */

    referenceNumber: varchar("reference_number", {
      length: 100,
    }),

    notes: text("notes"),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),
  }
);