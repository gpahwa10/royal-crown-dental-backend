import { pgTable, uuid, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { patients } from "./patients";

export const patientConsents = pgTable(
    "patient_consents",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        patientId: uuid("patient_id")
            .references(() => patients.id, { onDelete: "cascade" })
            .notNull(),
        treatmentConsentSigned: boolean("treatment_consent_signed")
            .notNull()
            .default(false),
        privacyAccepted: boolean("privacy_accepted").notNull().default(false),
        acceptedAt: timestamp("accepted_at"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => ({
        patientIdUnique: uniqueIndex("patient_consents_patient_id_unique").on(
            table.patientId
        ),
    })
);
