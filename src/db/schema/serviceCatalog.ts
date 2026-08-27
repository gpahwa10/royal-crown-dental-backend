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
import { clinics } from "./clinic";

export const serviceCatalog = pgTable(
    "service_catalog",
    {
        id: uuid("id").primaryKey().defaultRandom(),

        serviceCode: varchar("service_code", { length: 50 }).notNull(),

        serviceName: text("service_name").notNull(),

        description: text("description"),

        category: text("category"),

        defaultPrice: integer("default_price").default(0).notNull(),

        taxPercentage: integer("tax_percentage").default(0).notNull(),

        isTaxable: boolean("is_taxable").default(false).notNull(),

        isActive: boolean("is_active").default(true).notNull(),

        clinicId: uuid("clinic_id")
            .references(() => clinics.id)
            .notNull(),

        createdAt: timestamp("created_at").defaultNow().notNull(),

        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex("service_catalog_clinic_code_unique").on(
            table.clinicId,
            table.serviceCode
        ),
    ]
);
