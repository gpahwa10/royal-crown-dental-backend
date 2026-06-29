import { consultations } from "./consultations";
import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { patients } from "./patients";

export const followUps = pgTable("follow_ups", {
    id: uuid("id").primaryKey().defaultRandom(),

    consultationId: uuid("consultation_id")
        .references(() => consultations.id)
        .notNull(),

    patientId: uuid("patient_id")
        .references(() => patients.id)
        .notNull(),

    followUpDate: timestamp("follow_up_date")
        .notNull(),

    notes: text("notes"),

    completed: boolean("completed")
        .default(false)
        .notNull(),

    createdAt: timestamp("created_at")
        .defaultNow()
        .notNull(),
});