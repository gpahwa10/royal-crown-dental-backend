import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { consultations } from "./consultations";
import { patients } from "./patients";
import { employees } from "./employees";

export const prescriptions = pgTable(
    "prescriptions",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        consultationId: uuid("consultation_id")
            .references(() => consultations.id, { onDelete: "cascade" })
            .notNull(),
        patientId: uuid("patient_id")
            .references(() => patients.id)
            .notNull(),
        doctorId: uuid("doctor_id")
            .references(() => employees.id)
            .notNull(),
        notes: text("notes"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
        consultationIdUnique: uniqueIndex(
            "prescriptions_consultation_id_unique"
        ).on(table.consultationId),
    })
);
