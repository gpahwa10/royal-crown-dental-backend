import {
    pgTable,
    uuid,
    varchar,
    jsonb,
    timestamp,
    index,
} from "drizzle-orm/pg-core";
import { patients } from "./patients";
import { clinics } from "./clinic";
import { consultations } from "./consultations";

export const odontogramChanges = pgTable(
    "odontogram_changes",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        patientId: uuid("patient_id")
            .notNull()
            .references(() => patients.id, { onDelete: "cascade" }),
        clinicId: uuid("clinic_id")
            .notNull()
            .references(() => clinics.id, { onDelete: "cascade" }),
        consultationId: uuid("consultation_id")
            .notNull()
            .references(() => consultations.id, { onDelete: "cascade" }),
        toothNumber: varchar("tooth_number", { length: 20 }),
        changeType: varchar("change_type", { length: 50 }).notNull(),
        previousState: jsonb("previous_state").$type<Record<string, unknown> | null>(),
        newState: jsonb("new_state").$type<Record<string, unknown>>().notNull(),
        createdBy: uuid("created_by").notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => ({
        consultationIdIdx: index(
            "odontogram_changes_consultation_id_idx"
        ).on(table.consultationId),
        patientCreatedAtIdx: index(
            "odontogram_changes_patient_created_at_idx"
        ).on(table.patientId, table.createdAt),
    })
);
