import { pgTable, varchar, uuid } from "drizzle-orm/pg-core";
import { labRequests } from "./labRequests";

export const labRequestTests = pgTable(
    "lab_request_tests",
    {
        id: uuid("id").primaryKey().defaultRandom(),

        labRequestId: uuid("lab_request_id")
            .references(() => labRequests.id, {
                onDelete: "cascade",
            })
            .notNull(),

        testName: varchar("test_name", { length: 255 }).notNull(),
    }
);