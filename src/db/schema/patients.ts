import {
    pgTable,
    varchar,
    text,
    uuid,
    timestamp,
    pgEnum,
    boolean,
    uniqueIndex,
} from "drizzle-orm/pg-core";
import { clinics } from "./clinic";

export const patientTypeEnum = pgEnum("patient_type", ["new", "existing"]);

export const pregnancyStatusEnum = pgEnum("pregnancy_status", [
    "Not Applicable",
    "Pregnant",
    "Not Pregnant",
]);

export const patients = pgTable(
    "patients",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        patientCode: varchar("patient_code", { length: 50 }).notNull(),
        clinicId: uuid("clinic_id")
            .references(() => clinics.id, { onDelete: "cascade" })
            .notNull(),
        patientType: patientTypeEnum("patient_type").notNull().default("new"),
        name: varchar("name", { length: 255 }).notNull(),
        phone: varchar("phone", { length: 20 }).notNull(),
        email: varchar("email", { length: 255 }),
        gender: varchar("gender", { length: 50 }).notNull(),
        dateOfBirth: timestamp("date_of_birth").notNull(),
        address: text("address"),
        emergencyContactName: varchar("emergency_contact_name", {
            length: 255,
        }),
        emergencyContactPhone: varchar("emergency_contact_phone", {
            length: 20,
        }),
        emergencyContactRelation: varchar("emergency_contact_relation", {
            length: 100,
        }),
        isPremiumMember: boolean("is_premium_member").default(false).notNull(),
        isBlackListed: boolean("is_black_listed").default(false).notNull(),
        blackListedReason: text("black_listed_reason"),
        lastVisitAt: timestamp("last_visit_at"),
        isActive: boolean("is_active").default(true).notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
        patientCodeUnique: uniqueIndex("patients_patient_code_unique").on(
            table.patientCode
        ),
    })
);
