import { pgEnum, pgTable, timestamp, uuid, varchar, text } from "drizzle-orm/pg-core";
import { employees } from "./employees";
import { clinics } from "./clinic";

export const passwordResetRequestStatusEnum = pgEnum("password_reset_request_status", [
    "pending",
    "approved",
    "rejected",
]);

export const passwordResetRequests = pgTable("password_reset_requests", {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
        .references(() => employees.id, { onDelete: "cascade" })
        .notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    clinicId: uuid("clinic_id").references(() => clinics.id, { onDelete: "set null" }),
    note: text("note"),
    status: passwordResetRequestStatusEnum("status").notNull().default("pending"),
    resolvedAt: timestamp("resolved_at"),
    resolvedById: uuid("resolved_by_id"),
    resolvedByName: varchar("resolved_by_name", { length: 255 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
