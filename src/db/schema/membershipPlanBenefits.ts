import { integer, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { membershipPlans } from "./membershipPlans";

export const membershipDiscountTypeEnum = pgEnum("membership_discount_type", [
    "percentage",
    "fixed",
    "free",
]);

export const membershipPlanBenefits = pgTable("membership_plan_benefits", {
    id: uuid("id").primaryKey().defaultRandom(),

    membershipPlanId: uuid("membership_plan_id")
        .references(() => membershipPlans.id, { onDelete: "cascade" })
        .notNull(),

    serviceCode: varchar("service_code", { length: 50 }).notNull(),

    discountType: membershipDiscountTypeEnum("discount_type").notNull(),

    discountValue: integer("discount_value").default(0).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
});
