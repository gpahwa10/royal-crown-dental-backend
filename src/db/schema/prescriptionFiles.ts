import {
    bigint,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";
import { clinics } from "./clinic";
import { employees } from "./employees";
import { patients } from "./patients";
import { prescriptions } from "./prescriptions";

export const prescriptionFiles = pgTable(
    "prescription_files",
    {
        id: uuid("id").primaryKey().defaultRandom(),

        clinicId: uuid("clinic_id")
            .references(() => clinics.id)
            .notNull(),

        patientId: uuid("patient_id")
            .references(() => patients.id)
            .notNull(),

        prescriptionId: uuid("prescription_id")
            .references(() => prescriptions.id, { onDelete: "cascade" })
            .notNull(),

        bucket: text("bucket").notNull(),

        s3Key: text("s3_key").notNull(),

        originalFileName: text("original_file_name").notNull(),

        mimeType: text("mime_type").notNull(),

        size: bigint("size", { mode: "number" }).notNull(),

        uploadedBy: uuid("uploaded_by").references(() => employees.id),

        createdAt: timestamp("created_at").defaultNow().notNull(),

        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex("prescription_files_prescription_id_unique").on(
            table.prescriptionId
        ),
        uniqueIndex("prescription_files_s3_key_unique").on(table.s3Key),
    ]
);
