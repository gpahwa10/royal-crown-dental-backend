import {
    integer,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import { clinics } from "./clinic";
import { employees } from "./employees";
import { files } from "./files";
import { patients } from "./patients";

export const invoiceStatusEnum = pgEnum("invoice_status", [
    "draft",
    "pending",
    "partially_paid",
    "paid",
    "cancelled",
    "refunded",
]);

export const invoiceSourceTypeEnum = pgEnum("invoice_source_type", [
    "consultation",
    "lab_request",
    "radiograph",
    "dental_lab",
    "membership",
    "manual",
]);

export const invoices = pgTable(
    "invoices",
    {
        id: uuid("id").primaryKey().defaultRandom(),

        invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),

        patientId: uuid("patient_id")
            .references(() => patients.id)
            .notNull(),

        clinicId: uuid("clinic_id")
            .references(() => clinics.id)
            .notNull(),

        sourceType: invoiceSourceTypeEnum("source_type")
            .default("manual")
            .notNull(),

        sourceId: uuid("source_id"),

        subtotal: integer("subtotal").notNull(),

        membershipDiscount: integer("membership_discount").default(0).notNull(),

        manualDiscount: integer("manual_discount").default(0).notNull(),

        taxAmount: integer("tax_amount").default(0).notNull(),

        grandTotal: integer("grand_total").notNull(),

        amountPaid: integer("amount_paid").default(0).notNull(),

        balanceAmount: integer("balance_amount").notNull(),

        status: invoiceStatusEnum("status").default("pending").notNull(),

        generatedBy: uuid("generated_by").references(() => employees.id),

        invoicePdfFileId: uuid("invoice_pdf_file_id").references(() => files.id),

        createdAt: timestamp("created_at").defaultNow().notNull(),

        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex("invoices_invoice_number_unique").on(table.invoiceNumber),
    ]
);
