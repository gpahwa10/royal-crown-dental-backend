import { pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { employees } from "./employees";
import { employeeRoles } from "./roles";

export const employeeRoleAssignments = pgTable(
    "employee_role_assignments",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        employeeId: uuid("employee_id")
            .references(() => employees.id, { onDelete: "cascade" })
            .notNull(),
        roleId: uuid("role_id")
            .references(() => employeeRoles.id, { onDelete: "cascade" })
            .notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => ({
        employeeRoleUnique: unique("employee_role_assignments_employee_role_unique").on(
            table.employeeId,
            table.roleId
        ),
    })
);
