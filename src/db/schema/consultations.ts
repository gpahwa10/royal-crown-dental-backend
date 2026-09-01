import {
    pgTable,
    uuid,
    text,
    boolean,
    timestamp,
    varchar,
    pgEnum,
    uniqueIndex,
    index,
} from "drizzle-orm/pg-core";
import { patients } from "./patients";
import { employees } from "./employees";
import { clinics } from "./clinic";
import { appointments } from "./appointments";

export const consultationStatusEnum = pgEnum("consultation_status", [
    "draft",
    "in_progress",
    "completed",
    "cancelled",
]);

export const consultations = pgTable(
    "consultations",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        consultationCode: varchar("consultation_code", {
            length: 50,
        }).notNull(),
        clinicId: uuid("clinic_id")
            .references(() => clinics.id)
            .notNull(),
        patientId: uuid("patient_id")
            .references(() => patients.id)
            .notNull(),
        doctorId: uuid("doctor_id")
            .references(() => employees.id)
            .notNull(),
        appointmentId: uuid("appointment_id").references(
            () => appointments.id,
            { onDelete: "set null" }
        ),
        chiefComplaint: text("chief_complaint").notNull(),
        diagnosis: text("diagnosis"),
        treatmentPlan: text("treatment_plan"),
        clinicalNotes: text("clinical_notes"),
        nextVisitDate: timestamp("next_visit_date"),
        status: consultationStatusEnum("status").notNull().default("draft"),
        consentRequired: boolean("consent_required").default(false).notNull(),
        consentSigned: boolean("consent_signed").default(false).notNull(),
        consentSignatureUrl: text("consent_signature_url"),
        consentSignedAt: timestamp("consent_signed_at"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
        consultationCodeUnique: uniqueIndex(
            "consultations_consultation_code_unique"
        ).on(table.consultationCode),
        patientIdIdx: index("consultations_patient_id_idx").on(table.patientId),
        clinicIdIdx: index("consultations_clinic_id_idx").on(table.clinicId),
        doctorIdIdx: index("consultations_doctor_id_idx").on(table.doctorId),
        patientCreatedAtIdx: index("consultations_patient_created_at_idx").on(
            table.patientId,
            table.createdAt
        ),
    })
);
