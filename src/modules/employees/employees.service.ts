import { db } from "../../db/client";
import { employeeRoleAssignments } from "../../db/schema/employeeRoleAssignments";
import { employees } from "../../db/schema/employees";
import { employeeRoles } from "../../db/schema/roles";
import { and, count, eq, ne } from "drizzle-orm";
import bcrypt from "bcrypt";
import {
    resolveRolesFromDesignation,
    SALT_ROUNDS,
} from "../auth/auth.constants";

const omitPassword = <T extends { password: string }>(record: T) => {
    const { password: _, ...rest } = record;
    return rest;
};

const hashPassword = (password: string) =>
    bcrypt.hash(password, SALT_ROUNDS);

const getRoleByName = async (name: string) => {
    const [role] = await db
        .select()
        .from(employeeRoles)
        .where(eq(employeeRoles.name, name));

    if (!role) {
        throw new Error(`Role "${name}" is not configured`);
    }

    return role;
};

export const getEmployeeRoleNames = async (employeeId: string) => {
    const rows = await db
        .select({ name: employeeRoles.name })
        .from(employeeRoleAssignments)
        .innerJoin(
            employeeRoles,
            eq(employeeRoleAssignments.roleId, employeeRoles.id)
        )
        .where(eq(employeeRoleAssignments.employeeId, employeeId));

    return rows.map((row) => row.name);
};

export const assignRolesToEmployee = async (
    employeeId: string,
    roleNames: string[]
) => {
    const uniqueRoleNames = [...new Set(roleNames)];

    for (const roleName of uniqueRoleNames) {
        const role = await getRoleByName(roleName);
        await db
            .insert(employeeRoleAssignments)
            .values({
                employeeId,
                roleId: role.id,
            })
            .onConflictDoNothing({
                target: [
                    employeeRoleAssignments.employeeId,
                    employeeRoleAssignments.roleId,
                ],
            });
    }
};

export interface RegisterEmployeeInput {
    clinicId: string;
    name: string;
    email: string;
    password: string;
    phone?: string;
    designation: string;
    timings?: string;
    roles: string[];
}

export interface EditEmployeeInput {
    id: string;
    name?: string;
    email?: string;
    phone?: string;
    designation?: string;
    timings?: string;
    roles?: string[];
}


export interface BlockEmployeeInput {
    id: string;
    isBlocked: boolean;
}

export interface SuspendEmployeeInput {
    id: string;
    isSuspended: boolean;
}

export interface ActivateEmployeeInput {
    id: string;
}

export const registerEmployee = async (input: RegisterEmployeeInput) => {
    const uniqueRoles = [...new Set(input.roles)];

    for (const roleName of uniqueRoles) {
        await getRoleByName(roleName);
    }

    const [existing] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.email, input.email));

    if (existing) {
        throw new Error("An employee with this email already exists");
    }

    const hashedPassword = await hashPassword(input.password);

    const [employee] = await db
        .insert(employees)
        .values({
            clinicId: input.clinicId,
            name: input.name,
            email: input.email,
            password: hashedPassword,
            phone: input.phone ?? "",
            designation: input.designation,
            timings: input.timings,
        })
        .returning();

    await assignRolesToEmployee(employee.id, uniqueRoles);

    const roles = await getEmployeeRoleNames(employee.id);

    return {
        employee: {
            ...omitPassword(employee),
            roles,
        },
    };
};

export const registerStaff = (input: RegisterEmployeeInput) =>
    registerEmployee(input);

export const registerHR = (input: RegisterEmployeeInput) =>
    registerEmployee(input);

export interface ListEmployeesOptions {
    clinicId?: string;
    page?: number;
    limit?: number;
}

export const listEmployees = async (options: ListEmployeesOptions = {}) => {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 10));
    const offset = (page - 1) * limit;

    const clinicFilter = options.clinicId
        ? eq(employees.clinicId, options.clinicId)
        : undefined;

    const [countResult] = clinicFilter
        ? await db
            .select({ value: count() })
            .from(employees)
            .where(clinicFilter)
        : await db.select({ value: count() }).from(employees);

    const total = Number(countResult.value);

    const employeesData = clinicFilter
        ? await db
            .select()
            .from(employees)
            .where(clinicFilter)
            .limit(limit)
            .offset(offset)
        : await db.select().from(employees).limit(limit).offset(offset);

    const items = await Promise.all(
        employeesData.map(async (employee) => ({
            ...omitPassword(employee),
            roles: await getEmployeeRoleNames(employee.id),
        }))
    );

    return {
        items,
        pagination: {
            page,
            limit,
            total,
            totalPages: total === 0 ? 0 : Math.ceil(total / limit),
        },
    };
};


export const getEmployeeById = async (id: string) => {
    const [employee] = await db
        .select()
        .from(employees)
        .where(eq(employees.id, id));

    return employee ?? null;
};

export const editEmployee = async (input: EditEmployeeInput) => {
    const existing = await getEmployeeById(input.id);

    if (!existing) {
        throw new Error("Employee not found");
    }

    if (input.email && input.email !== existing.email) {
        const [duplicate] = await db
            .select({ id: employees.id })
            .from(employees)
            .where(
                and(
                    eq(employees.email, input.email),
                    ne(employees.id, input.id)
                )
            );

        if (duplicate) {
            throw new Error("An employee with this email already exists");
        }
    }

    const updateData: Partial<typeof employees.$inferInsert> = {
        updatedAt: new Date(),
    };

    if (input.name !== undefined) {
        updateData.name = input.name;
    }
    if (input.email !== undefined) {
        updateData.email = input.email;
    }
    if (input.phone !== undefined) {
        updateData.phone = input.phone;
    }
    if (input.designation !== undefined) {
        updateData.designation = input.designation;
    }
    if (input.timings !== undefined) {
        updateData.timings = input.timings;
    }

    const [employee] = await db
        .update(employees)
        .set(updateData)
        .where(eq(employees.id, input.id))
        .returning();

    if (input.roles !== undefined) {
        await db
            .delete(employeeRoleAssignments)
            .where(eq(employeeRoleAssignments.employeeId, input.id));
        await assignRolesToEmployee(input.id, input.roles);
    } else if (input.designation !== undefined) {
        const roleNames = resolveRolesFromDesignation(input.designation);
        await db
            .delete(employeeRoleAssignments)
            .where(eq(employeeRoleAssignments.employeeId, input.id));
        await assignRolesToEmployee(input.id, roleNames);
    }

    const roles = await getEmployeeRoleNames(input.id);

    return {
        employee: {
            ...omitPassword(employee),
            roles,
        },
    };
};

export const blockEmployee = async (id: string, isBlocked: boolean) => {
    await db
        .update(employees)
        .set({ isBlocked: isBlocked, updatedAt: new Date() })
        .where(eq(employees.id, id));
};

export const suspendEmployee = async (id: string, isSuspended: boolean) => {
    await db
        .update(employees)
        .set({ isSuspended: isSuspended, updatedAt: new Date() })
        .where(eq(employees.id, id));
};

export const activateEmployee = async (id: string) => {
    await db
        .update(employees)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(employees.id, id));
};
