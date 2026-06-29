import { pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { employees } from "./employees";
import { invoices } from "./invoices";
import { membershipPlans } from "./membershipPlans";
import { patients } from "./patients";

export const patientMembershipStatusEnum = pgEnum("patient_membership_status", [
    "pending_payment",
    "active",
    "expired",
    "cancelled",
]);

export const patientMemberships = pgTable("patient_memberships", {
    id: uuid("id").primaryKey().defaultRandom(),

    patientId: uuid("patient_id")
        .references(() => patients.id)
        .notNull(),

    membershipPlanId: uuid("membership_plan_id")
        .references(() => membershipPlans.id)
        .notNull(),

    invoiceId: uuid("invoice_id")
        .references(() => invoices.id)
        .notNull(),

    purchaseDate: timestamp("purchase_date").defaultNow().notNull(),

    startDate: timestamp("start_date"),

    expiryDate: timestamp("expiry_date"),

    status: patientMembershipStatusEnum("status")
        .default("pending_payment")
        .notNull(),

    purchasedBy: uuid("purchased_by").references(() => employees.id),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
