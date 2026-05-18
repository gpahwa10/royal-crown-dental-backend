import { pgTable, uuid, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { employeeRoles } from "./roles";
import { clinics } from "./clinic";
export const employees = pgTable('employees', {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
    .references(() => clinics.id, {
      onDelete: "cascade"
    })
    .notNull(),
    firstName: varchar('first_name', { length: 255 }).notNull(),
    lastName: varchar('last_name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).unique().notNull(),
    password: varchar('password', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 255 }).notNull(),
    designation: varchar('designation', { length: 255 }).notNull(),
    roleId: uuid('role_id').references(() => employeeRoles.id).notNull(),
    isBlocked: boolean('is_blocked').default(false).notNull(),
    isSuspended: boolean('is_suspended').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    lastLoginAt: timestamp('last_login_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
})