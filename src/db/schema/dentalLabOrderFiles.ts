import { pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { dentalLabOrders } from "./dentalLabOrders";
import { files } from "./files";

export const dentalLabOrderFiles = pgTable(
    "dental_lab_order_files",
    {
        id: uuid("id").primaryKey().defaultRandom(),

        dentalLabOrderId: uuid("dental_lab_order_id")
            .references(() => dentalLabOrders.id, { onDelete: "cascade" })
            .notNull(),

        fileId: uuid("file_id")
            .references(() => files.id)
            .notNull(),

        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex("dental_lab_order_files_order_file_unique").on(
            table.dentalLabOrderId,
            table.fileId
        ),
    ]
);
