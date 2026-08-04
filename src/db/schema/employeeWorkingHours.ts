import {
    boolean,
    integer,
    pgTable,
    timestamp,
    unique,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import { employees } from "./employees";

export const employeeWorkingHours = pgTable(
    "employee_working_hours",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        employeeId: uuid("employee_id")
            .references(() => employees.id, { onDelete: "cascade" })
            .notNull(),
        dayOfWeek: integer("day_of_week").notNull(),
        startTime: varchar("start_time", { length: 8 }),
        endTime: varchar("end_time", { length: 8 }),
        isOff: boolean("is_off").default(false).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (t) => [unique().on(t.employeeId, t.dayOfWeek)]
);
