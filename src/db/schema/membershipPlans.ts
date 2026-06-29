import {
    boolean,
    integer,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";

export const membershipPlans = pgTable(
    "membership_plans",
    {
        id: uuid("id").primaryKey().defaultRandom(),

        planCode: varchar("plan_code", { length: 50 }).notNull(),

        planName: text("plan_name").notNull(),

        description: text("description"),

        price: integer("price").notNull(),

        validityDays: integer("validity_days").notNull(),

        isActive: boolean("is_active").default(true).notNull(),

        createdAt: timestamp("created_at").defaultNow().notNull(),

        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex("membership_plans_plan_code_unique").on(table.planCode),
    ]
);
