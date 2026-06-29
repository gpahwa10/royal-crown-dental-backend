import {
    boolean,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import { appointments } from "./appointments";
import { clinics } from "./clinic";
import { consultations } from "./consultations";
import { employees } from "./employees";
import { invoices } from "./invoices";
import { leads } from "./leads";
import { patientMemberships } from "./patientMemberships";
import { patients } from "./patients";

export const clinicVisitPurposeEnum = pgEnum("clinic_visit_purpose", [
    "consultation",
    "treatment",
    "follow_up",
    "enquiry",
    "emergency",
    "billing",
    "membership",
    "report_collection",
    "medicine_collection",
    "document_submission",
    "other",
]);

export const clinicVisitOutcomeEnum = pgEnum("clinic_visit_outcome", [
    "enquiry_only",
    "appointment_booked",
    "patient_registered",
    "consultation_completed",
    "treatment_started",
    "treatment_completed",
    "billing_completed",
    "membership_purchased",
    "reports_collected",
    "cancelled",
    "left_without_consultation",
    "referred",
    "other",
]);

export const clinicVisitStatusEnum = pgEnum("clinic_visit_status", [
    "checked_in",
    "in_progress",
    "completed",
    "cancelled",
]);

export const clinicVisits = pgTable(
    "clinic_visits",
    {
        id: uuid("id").primaryKey().defaultRandom(),

        visitNumber: varchar("visit_number", { length: 50 }).notNull(),

        clinicId: uuid("clinic_id")
            .references(() => clinics.id)
            .notNull(),

        patientId: uuid("patient_id").references(() => patients.id, {
            onDelete: "set null",
        }),

        leadId: uuid("lead_id").references(() => leads.id, {
            onDelete: "set null",
        }),

        appointmentId: uuid("appointment_id").references(
            () => appointments.id,
            { onDelete: "set null" }
        ),

        consultationId: uuid("consultation_id").references(
            () => consultations.id,
            { onDelete: "set null" }
        ),

        invoiceId: uuid("invoice_id").references(() => invoices.id, {
            onDelete: "set null",
        }),

        membershipId: uuid("membership_id").references(
            () => patientMemberships.id,
            { onDelete: "set null" }
        ),

        visitorName: text("visitor_name").notNull(),

        visitorPhone: varchar("visitor_phone", { length: 20 }).notNull(),

        visitorEmail: varchar("visitor_email", { length: 255 }),

        doctorId: uuid("doctor_id").references(() => employees.id, {
            onDelete: "set null",
        }),

        visitDate: timestamp("visit_date").notNull(),

        checkInTime: timestamp("check_in_time").notNull(),

        checkOutTime: timestamp("check_out_time"),

        purpose: clinicVisitPurposeEnum("purpose").notNull(),

        outcome: clinicVisitOutcomeEnum("outcome"),

        status: clinicVisitStatusEnum("status")
            .default("checked_in")
            .notNull(),

        isRegistered: boolean("is_registered").default(false).notNull(),

        treatmentPerformed: text("treatment_performed"),

        notes: text("notes"),

        createdBy: uuid("created_by").references(() => employees.id, {
            onDelete: "set null",
        }),

        createdAt: timestamp("created_at").defaultNow().notNull(),

        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex("clinic_visits_visit_number_unique").on(table.visitNumber),
    ]
);
