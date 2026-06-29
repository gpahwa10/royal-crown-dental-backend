import { pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { clinicVisits } from "./clinicVisits";
import { files } from "./files";

export const clinicVisitFiles = pgTable(
    "clinic_visit_files",
    {
        id: uuid("id").primaryKey().defaultRandom(),

        clinicVisitId: uuid("clinic_visit_id")
            .references(() => clinicVisits.id, { onDelete: "cascade" })
            .notNull(),

        fileId: uuid("file_id")
            .references(() => files.id)
            .notNull(),

        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex("clinic_visit_files_visit_file_unique").on(
            table.clinicVisitId,
            table.fileId
        ),
    ]
);
