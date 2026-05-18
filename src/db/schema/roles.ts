import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";

export const employeeRoles = pgTable('employeeRoles',{

    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', {length: 255}).unique().notNull(),
    description: varchar('description', {length: 255}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
})