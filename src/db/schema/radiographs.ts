import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { clinics } from "./clinic";
import { consultations } from "./consultations";
import { employees } from "./employees";
import { files } from "./files";
import { patients } from "./patients";

export const radiographStatusEnum = pgEnum("radiograph_status", [
    "scheduled",
    "acquired",
    "reported",
]);

export const radiographs = pgTable("radiographs", {
    id: uuid("id").primaryKey().defaultRandom(),

    consultationId: uuid("consultation_id")
        .references(() => consultations.id)
        .notNull(),

    patientId: uuid("patient_id")
        .references(() => patients.id)
        .notNull(),

    doctorId: uuid("doctor_id")
        .references(() => employees.id)
        .notNull(),

    clinicId: uuid("clinic_id")
        .references(() => clinics.id)
        .notNull(),

    studyType: text("study_type").notNull(),

    toothRegion: text("tooth_region"),

    scheduledDate: timestamp("scheduled_date"),

    notes: text("notes"),

    imageFileId: uuid("image_file_id").references(() => files.id),

    reportFileId: uuid("report_file_id").references(() => files.id),

    reportText: text("report_text"),

    status: radiographStatusEnum("status").default("scheduled").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
});
