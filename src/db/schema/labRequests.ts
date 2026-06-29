import {
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import { clinics } from "./clinic";
import { consultations } from "./consultations";
import { employees } from "./employees";
import { patients } from "./patients";

export const labRequestStatusEnum = pgEnum("lab_request_status", [
    "sample_collected",
    "under_examination",
    "delivered",
]);

export const labRequests = pgTable(
    "lab_requests",
    {
        id: uuid("id").primaryKey().defaultRandom(),

        labRequestCode: varchar("lab_request_code", { length: 50 }).notNull(),

        consultationId: uuid("consultation_id").references(
            () => consultations.id
        ),

        patientId: uuid("patient_id")
            .references(() => patients.id)
            .notNull(),

        doctorId: uuid("doctor_id")
            .references(() => employees.id)
            .notNull(),

        clinicId: uuid("clinic_id")
            .references(() => clinics.id)
            .notNull(),

        externalLabName: text("external_lab_name"),

        notes: text("notes"),

        status: labRequestStatusEnum("status")
            .default("sample_collected")
            .notNull(),

        collectedDate: timestamp("collected_date").defaultNow().notNull(),

        underExaminationDate: timestamp("under_examination_date"),

        deliveredDate: timestamp("delivered_date"),

        createdAt: timestamp("created_at").defaultNow().notNull(),

        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex("lab_requests_lab_request_code_unique").on(
            table.labRequestCode
        ),
    ]
);
