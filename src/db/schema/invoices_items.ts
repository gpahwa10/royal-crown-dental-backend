import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { invoices } from "./invoices";
import { serviceCatalog } from "./serviceCatalog";

export const invoiceItems = pgTable("invoice_items", {
    id: uuid("id").primaryKey().defaultRandom(),

    invoiceId: uuid("invoice_id")
        .references(() => invoices.id, { onDelete: "cascade" })
        .notNull(),

    serviceId: uuid("service_id").references(() => serviceCatalog.id),

    serviceName: text("service_name").notNull(),

    quantity: integer("quantity").notNull(),

    unitPrice: integer("unit_price").notNull(),

    discountAmount: integer("discount_amount").default(0).notNull(),

    taxPercentage: integer("tax_percentage").default(0).notNull(),

    taxAmount: integer("tax_amount").default(0).notNull(),

    lineTotal: integer("line_total").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
});
