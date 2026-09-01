import {
    pgTable,
    uuid,
    jsonb,
    integer,
    timestamp,
    uniqueIndex,
} from "drizzle-orm/pg-core";
import { consultations } from "./consultations";
import { patients } from "./patients";
import { clinics } from "./clinic";

export const consultationOdontograms = pgTable(
    "consultation_odontograms",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        consultationId: uuid("consultation_id")
            .notNull()
            .references(() => consultations.id, { onDelete: "cascade" }),
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
        chartVersion: integer("chart_version").notNull().default(1),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
        consultationUnique: uniqueIndex(
            "consultation_odontograms_consultation_unique"
        ).on(table.consultationId),
    })
);
