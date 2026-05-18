import { db } from "../../db/client";
import { employeeRoleAssignments } from "../../db/schema/employeeRoleAssignments";
import { employees } from "../../db/schema/employees";
import { employeeRoles } from "../../db/schema/roles";
import { superAdmins } from "../../db/schema/superAdmins";
import { count, eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { generateToken } from "../../utils/generateToken";
import {
    hasPlatformAdminAccess,
    SALT_ROUNDS,
} from "./auth.constants";

type EmployeeRecord = typeof employees.$inferSelect;
type SuperAdminRecord = typeof superAdmins.$inferSelect;

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

const getEmployeeRoleNames = async (employeeId: string) => {
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

const assignRolesToEmployee = async (
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

const assertEmployeeCanLogin = (employee: EmployeeRecord) => {
    if (!employee.isActive) {
        throw new Error("Employee account is not active");
    }
    if (employee.isBlocked) {
        throw new Error("Employee is restricted from accessing the system");
    }
    if (employee.isSuspended) {
        throw new Error(
            "Employee account is suspended from accessing the system"
        );
    }
};

const assertSuperAdminCanLogin = (admin: SuperAdminRecord) => {
    if (!admin.isActive) {
        throw new Error("Super admin account is not active");
    }
    if (admin.isBlocked) {
        throw new Error(
            "Super admin is restricted from accessing the system"
        );
    }
};

const buildEmployeeToken = async (employee: EmployeeRecord) => {
    const roles = await getEmployeeRoleNames(employee.id);

    if (roles.length === 0) {
        throw new Error("Employee has no roles assigned");
    }

    return generateToken({
        id: employee.id,
        clinicId: employee.clinicId,
        roles,
        isSuperAdmin: false,
    });
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

export interface CreateSuperAdminInput {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
}

export const login = async (email: string, password: string) => {
    const [employee] = await db
        .select()
        .from(employees)
        .where(eq(employees.email, email));

    if (employee) {
        assertEmployeeCanLogin(employee);

        const isPasswordValid = await bcrypt.compare(
            password,
            employee.password
        );
        if (!isPasswordValid) {
            throw new Error("Invalid credentials");
        }

        const roles = await getEmployeeRoleNames(employee.id);
        const token = await buildEmployeeToken(employee);

        return {
            user: omitPassword(employee),
            token,
            roles,
            isSuperAdmin: false,
            hasPlatformAdminAccess: hasPlatformAdminAccess({
                isSuperAdmin: false,
                roles,
            }),
            clinicId: employee.clinicId,
        };
    }

    const [admin] = await db
        .select()
        .from(superAdmins)
        .where(eq(superAdmins.email, email));

    if (!admin) {
        throw new Error("Invalid credentials");
    }

    assertSuperAdminCanLogin(admin);

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
        throw new Error("Invalid credentials");
    }

    const token = generateToken({
        id: admin.id,
        clinicId: null,
        roles: [],
        isSuperAdmin: true,
    });

    return {
        user: omitPassword(admin),
        token,
        roles: [] as string[],
        isSuperAdmin: true,
        hasPlatformAdminAccess: true,
        clinicId: null,
    };
};

const registerEmployee = async (input: RegisterEmployeeInput) => {
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

export const createSuperAdmin = async (input: CreateSuperAdminInput) => {
    const [existing] = await db
        .select({ id: superAdmins.id })
        .from(superAdmins)
        .where(eq(superAdmins.email, input.email));

    if (existing) {
        throw new Error("A super admin with this email already exists");
    }

    const hashedPassword = await hashPassword(input.password);

    const [admin] = await db
        .insert(superAdmins)
        .values({
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email,
            password: hashedPassword,
        })
        .returning();

    return { superAdmin: omitPassword(admin) };
};

export const hasSuperAdmins = async () => {
    const [result] = await db.select({ value: count() }).from(superAdmins);
    return Number(result.value) > 0;
};

export const logout = async () => {
    return { message: "Logged out successfully" };
};

export { getEmployeeRoleNames, assignRolesToEmployee };
