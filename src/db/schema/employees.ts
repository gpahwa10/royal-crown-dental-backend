import {
    integer,
    pgTable,
    timestamp,
    uuid,
    varchar,
    boolean,
} from "drizzle-orm/pg-core";
import { clinics } from "./clinic";

export const employees = pgTable("employees", {
    id: uuid("id").primaryKey().defaultRandom(),
    legacyId: integer("legacy_id").unique(),
    clinicId: uuid("clinic_id")
        .references(() => clinics.id, {
            onDelete: "cascade",
        })
        .notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).unique().notNull(),
    password: varchar("password", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 255 }).notNull().default(""),
    designation: varchar("designation", { length: 255 }).notNull(),
    timings: varchar("timings", { length: 255 }),
    isBlocked: boolean("is_blocked").default(false).notNull(),
    isSuspended: boolean("is_suspended").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
