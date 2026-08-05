import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { employees } from "./employees";
import { prescriptionFiles } from "./prescriptionFiles";

export const prescriptionShareLinks = pgTable(
    "prescription_share_links",
    {
        id: uuid("id").primaryKey().defaultRandom(),

        token: text("token").notNull(),

        fileId: uuid("file_id")
            .references(() => prescriptionFiles.id, { onDelete: "cascade" })
            .notNull(),

        expiresAt: timestamp("expires_at").notNull(),

        createdBy: uuid("created_by").references(() => employees.id),

        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex("prescription_share_links_token_unique").on(table.token),
    ]
);
