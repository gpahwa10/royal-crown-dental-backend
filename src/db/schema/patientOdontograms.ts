import {
    pgTable,
    uuid,
    jsonb,
    integer,
    timestamp,
    uniqueIndex,
} from "drizzle-orm/pg-core";
import { patients } from "./patients";
import { clinics } from "./clinic";

export const patientOdontograms = pgTable(
    "patient_odontograms",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        patientId: uuid("patient_id")
            .notNull()
            .references(() => patients.id, { onDelete: "cascade" }),
        clinicId: uuid("clinic_id")
            .notNull()
            .references(() => clinics.id, { onDelete: "cascade" }),
        statusChart: jsonb("status_chart")
            .$type<Record<string, unknown>>()
            .notNull(),
        planChart: jsonb("plan_chart").$type<Record<string, unknown>>(),
        version: integer("version").notNull().default(1),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
        patientClinicUnique: uniqueIndex(
            "patient_odontograms_patient_clinic_unique"
        ).on(table.patientId, table.clinicId),
    })
);
