import {
    bigint,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";
import { clinics } from "./clinic";
import { employees } from "./employees";
import { patients } from "./patients";

export const fileDocumentTypeEnum = pgEnum("file_document_type", [
    "lab_report",
    "radiograph",
    "prescription",
    "invoice",
    "consent",
    "treatment",
    "patient_document",
    "other",
]);

export const fileUploadStatusEnum = pgEnum("file_upload_status", [
    "pending_upload",
    "uploaded",
    "archived",
]);

export const files = pgTable(
    "files",
    {
        id: uuid("id").primaryKey().defaultRandom(),

        patientId: uuid("patient_id")
            .references(() => patients.id)
            .notNull(),

        clinicId: uuid("clinic_id")
            .references(() => clinics.id)
            .notNull(),

        documentType: fileDocumentTypeEnum("document_type").notNull(),

        originalFileName: text("original_file_name").notNull(),

        objectKey: text("object_key").notNull(),

        bucket: text("bucket").notNull(),

        contentType: text("content_type").notNull(),

        fileSize: bigint("file_size", { mode: "number" }),

        status: fileUploadStatusEnum("status")
            .default("pending_upload")
            .notNull(),

        uploadedBy: uuid("uploaded_by").references(() => employees.id),

        createdAt: timestamp("created_at").defaultNow().notNull(),

        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex("files_object_key_unique").on(table.objectKey),
    ]
);
