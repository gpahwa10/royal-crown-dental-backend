import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { files } from "./files";
import { labRequests } from "./labRequests";

export const labReports = pgTable("lab_reports", {
    id: uuid("id").primaryKey().defaultRandom(),

    labRequestId: uuid("lab_request_id")
        .references(() => labRequests.id, {
            onDelete: "cascade",
        })
        .notNull(),

    fileId: uuid("file_id").references(() => files.id),

    reportName: text("report_name").notNull(),

    reportUrl: text("report_url").notNull(),

    uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});
