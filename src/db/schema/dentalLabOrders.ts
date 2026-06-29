import {
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
import { patients } from "./patients";

export const dentalLabOrderStatusEnum = pgEnum("dental_lab_order_status", [
    "ordered",
    "delivered",
    "cementation_done",
]);

export const dentalLabOrders = pgTable(
    "dental_lab_orders",
    {
        id: uuid("id").primaryKey().defaultRandom(),

        orderCode: varchar("order_code", { length: 50 }).notNull(),

        patientId: uuid("patient_id")
            .references(() => patients.id)
            .notNull(),

        consultationId: uuid("consultation_id").references(
            () => consultations.id
        ),

        clinicId: uuid("clinic_id")
            .references(() => clinics.id)
            .notNull(),

        measuredByDoctorId: uuid("measured_by_doctor_id")
            .references(() => employees.id)
            .notNull(),

        cementationDoctorId: uuid("cementation_doctor_id").references(
            () => employees.id
        ),

        cementationAppointmentId: uuid("cementation_appointment_id").references(
            () => appointments.id
        ),

        labName: text("lab_name").notNull(),

        itemType: text("item_type").notNull(),

        toothNumber: text("tooth_number"),

        shade: text("shade"),

        description: text("description"),

        estimatedDeliveryDate: timestamp("estimated_delivery_date"),

        orderedDate: timestamp("ordered_date").defaultNow().notNull(),

        deliveredDate: timestamp("delivered_date"),

        cementationDate: timestamp("cementation_date"),

        status: dentalLabOrderStatusEnum("status").default("ordered").notNull(),

        notes: text("notes"),

        createdAt: timestamp("created_at").defaultNow().notNull(),

        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex("dental_lab_orders_order_code_unique").on(table.orderCode),
    ]
);
