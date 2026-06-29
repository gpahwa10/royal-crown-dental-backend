import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { prescriptions } from "./prescriptions";

export const prescriptionItems = pgTable("prescription_items", {
    id: uuid("id").primaryKey().defaultRandom(),
    prescriptionId: uuid("prescription_id")
        .references(() => prescriptions.id, { onDelete: "cascade" })
        .notNull(),
    medicineName: text("medicine_name").notNull(),
    dosage: text("dosage"),
    frequency: text("frequency"),
    duration: text("duration"),
    instructions: text("instructions"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
