import {
    boolean,
    integer,
    pgTable,
    timestamp,
    unique,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import { clinics } from "./clinic";

export const clinicWorkingHours = pgTable(
    "clinic_working_hours",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        clinicId: uuid("clinic_id")
            .references(() => clinics.id, { onDelete: "cascade" })
            .notNull(),
        dayOfWeek: integer("day_of_week").notNull(),
        openTime: varchar("open_time", { length: 8 }),
        closeTime: varchar("close_time", { length: 8 }),
        isClosed: boolean("is_closed").default(false).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (t) => [unique().on(t.clinicId, t.dayOfWeek)]
);
