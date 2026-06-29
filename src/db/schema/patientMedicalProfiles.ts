import {
    pgTable,
    uuid,
    varchar,
    text,
    timestamp,
    pgEnum,
    uniqueIndex,
} from "drizzle-orm/pg-core";
import { patients, pregnancyStatusEnum } from "./patients";

export const dentalAnxietyEnum = pgEnum("dental_anxiety", [
    "none",
    "mild",
    "moderate",
    "severe",
]);

export const patientMedicalProfiles = pgTable(
    "patient_medical_profiles",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        patientId: uuid("patient_id")
            .references(() => patients.id, { onDelete: "cascade" })
            .notNull(),
        allergies: varchar("allergies", { length: 255 }).array(),
        currentMedications: varchar("current_medications", {
            length: 255,
        }).array(),
        chronicConditions: varchar("chronic_conditions", {
            length: 255,
        }).array(),
        pregnancyStatus: pregnancyStatusEnum("pregnancy_status")
            .notNull()
            .default("Not Applicable"),
        dentalAnxiety: dentalAnxietyEnum("dental_anxiety")
            .notNull()
            .default("none"),
        lastDentalVisit: timestamp("last_dental_visit"),
        lastXrayDate: timestamp("last_xray_date"),
        primaryPhysicianName: varchar("primary_physician_name", {
            length: 255,
        }),
        primaryPhysicianPhone: varchar("primary_physician_phone", {
            length: 20,
        }),
        initialChiefComplaint: text("initial_chief_complaint"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
        patientIdUnique: uniqueIndex(
            "patient_medical_profiles_patient_id_unique"
        ).on(table.patientId),
    })
);
