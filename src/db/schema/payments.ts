import {
    integer,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uuid,
} from "drizzle-orm/pg-core";
import { employees } from "./employees";
import { invoices } from "./invoices";

export const paymentMethodEnum = pgEnum("payment_method", [
    "cash",
    "upi",
    "card",
    "finance",
    "bank_transfer",
    "cheque",
    "mpesa",
]);

export const payments = pgTable("payments", {
    id: uuid("id").primaryKey().defaultRandom(),

    invoiceId: uuid("invoice_id")
        .references(() => invoices.id, { onDelete: "cascade" })
        .notNull(),

    amount: integer("amount").notNull(),

    paymentMethod: paymentMethodEnum("payment_method").notNull(),

    paymentReference: text("payment_reference"),

    paymentDate: timestamp("payment_date").defaultNow().notNull(),

    receivedBy: uuid("received_by").references(() => employees.id),

    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
});
