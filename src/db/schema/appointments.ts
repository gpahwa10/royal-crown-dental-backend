import {
  pgTable,
  uuid,
  timestamp,
  text,
  pgEnum,
  integer,
  varchar,
} from "drizzle-orm/pg-core";

import { leads } from "./leads";
import { patients } from "./patients";
import { clinics } from "./clinic";
import { employees } from "./employees";

export const appointmentStatusEnum =
  pgEnum("appointment_status", [
    "scheduled",
    "checked_in",
    "in_progress",
    "completed",
    "cancelled",
    "no_show",
  ]);

export const appointmentTypeEnum = pgEnum("appointment_type", [
  "general",
  "consultation",
  "treatment",
  "follow_up",
]);

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id")
      .primaryKey()
      .defaultRandom(),

    appointmentCode: varchar(
      "appointment_code",
      {
        length: 50,
      }
    ).notNull(),

    clinicId: uuid("clinic_id")
      .references(() => clinics.id)
      .notNull(),

    employeeId: uuid("employee_id")
      .references(() => employees.id, {
        onDelete: "set null",
      }),

    patientId: uuid("patient_id")
      .references(() => patients.id, {
        onDelete: "set null",
      }),

    leadId: uuid("lead_id")
      .references(() => leads.id, {
        onDelete: "set null",
      }),

    appointmentType: appointmentTypeEnum("appointment_type")
      .default("general")
      .notNull(),

    dentalLabOrderId: uuid("dental_lab_order_id"),

    scheduledAt: timestamp(
      "scheduled_at",
      { withTimezone: true }
    ).notNull(),

    durationMinutes:
      integer("duration_minutes")
        .default(30)
        .notNull(),

    symptoms: text("symptoms"),

    status:
      appointmentStatusEnum(
        "status"
      ).default("scheduled"),

    checkedInAt: timestamp(
      "checked_in_at",
      {
        withTimezone: true,
      }
    ),

    completedAt: timestamp(
      "completed_at",
      {
        withTimezone: true,
      }
    ),

    cancelledReason: text(
      "cancelled_reason"
    ),

    createdAt: timestamp(
      "created_at",
      {
        withTimezone: true,
      }
    )
      .defaultNow()
      .notNull(),

    updatedAt: timestamp(
      "updated_at",
      {
        withTimezone: true,
      }
    )
      .defaultNow()
      .notNull(),
  }
);