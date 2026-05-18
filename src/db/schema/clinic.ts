import { pgTable, uuid, varchar, timestamp, boolean, text, integer } from "drizzle-orm/pg-core";
export const clinics = pgTable("clinics", {
    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    legacyClinicId: integer("legacy_clinic_id").unique(),

    clinicName: varchar("clinic_name", {
        length: 255
    }).notNull(),

    clinicCode: varchar("clinic_code", {
        length: 50
    })
        .unique()
        .notNull(),

    email: varchar("email", {
        length: 255
    }),

    phone: varchar("phone", {
        length: 20
    }),

    address: text("address"),

    city: varchar("city", {
        length: 100
    }),

    state: varchar("state", {
        length: 100
    }),

    country: varchar("country", {
        length: 100
    }),

    pincode: varchar("pincode", {
        length: 20
    }),

    isActive: boolean("is_active")
        .default(true)
        .notNull(),

    createdAt: timestamp("created_at")
        .defaultNow()
        .notNull(),

    updatedAt: timestamp("updated_at")
        .defaultNow()
        .notNull()
});