import { pgTable, uuid, varchar, timestamp, text, pgEnum } from "drizzle-orm/pg-core";
import { clinics } from "./clinic";
import { patients } from "./patients";

export const leadSourceEnum = pgEnum("lead_source", [
  "call",
  "whatsapp",
  "website",
  "walk_in",
  "referral",
  "qr_self",
]);

export const leadStatusEnum = pgEnum(
  "lead_status",
  [
    "new_query",
    "follow_up",
    "appointment_booked",
    "clinic_visited",
    "converted",
    "closed_lost",
    "no_show",
  ]
);
export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id")
    .references(() => clinics.id, { onDelete: "restrict" })
    .notNull(),
  patientId: uuid("patient_id").references(() => patients.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 20 }).notNull(),
  source: leadSourceEnum("source").notNull(),
  status: leadStatusEnum("status").notNull().default("new_query"),
  symptoms: text("symptoms"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
