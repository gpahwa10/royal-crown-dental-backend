import { db } from "../../db/client";
import { employees } from "../../db/schema/employees";
import { superAdmins } from "../../db/schema/superAdmins";
import { count, eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { generateToken } from "../../utils/generateToken";
import { getEmployeeRoleNames } from "../employees/employees.service";
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

const buildEmployeeToken = async (
    employee: EmployeeRecord,
    mustChangePassword?: boolean
) => {
    const roles = await getEmployeeRoleNames(employee.id);

    if (roles.length === 0) {
        throw new Error("Employee has no roles assigned");
    }

    return generateToken({
        id: employee.id,
        clinicId: employee.clinicId,
        roles,
        isSuperAdmin: false,
        mustChangePassword:
            mustChangePassword ?? employee.mustChangePassword,
    });
};

const buildSuperAdminToken = (
    admin: SuperAdminRecord,
    mustChangePassword?: boolean
) =>
    generateToken({
        id: admin.id,
        clinicId: null,
        roles: [],
        isSuperAdmin: true,
        mustChangePassword:
            mustChangePassword ?? admin.mustChangePassword,
    });

export interface CreateSuperAdminInput {
    name: string;
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

        const now = new Date();
        await db
            .update(employees)
            .set({ lastLoginAt: now, updatedAt: now })
            .where(eq(employees.id, employee.id));

        const roles = await getEmployeeRoleNames(employee.id);
        const token = await buildEmployeeToken(employee);

        return {
            user: omitPassword({
                ...employee,
                lastLoginAt: now,
            }),
            token,
            roles,
            isSuperAdmin: false,
            hasPlatformAdminAccess: hasPlatformAdminAccess({
                isSuperAdmin: false,
                roles,
            }),
            clinicId: employee.clinicId,
            mustChangePassword: employee.mustChangePassword,
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

    const now = new Date();
    await db
        .update(superAdmins)
        .set({ lastLoginAt: now, updatedAt: now })
        .where(eq(superAdmins.id, admin.id));

    const token = buildSuperAdminToken(admin);

    return {
        user: omitPassword({
            ...admin,
            lastLoginAt: now,
        }),
        token,
        roles: [] as string[],
        isSuperAdmin: true,
        hasPlatformAdminAccess: true,
        clinicId: null,
        mustChangePassword: admin.mustChangePassword,
    };
};

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
            name: input.name,
            email: input.email,
            password: hashedPassword,
            mustChangePassword: true,
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

export const changePassword = async (input: {
    userId: string;
    isSuperAdmin: boolean;
    currentPassword?: string;
    newPassword: string;
}) => {
    if (input.isSuperAdmin) {
        const [admin] = await db
            .select()
            .from(superAdmins)
            .where(eq(superAdmins.id, input.userId));

        if (!admin) {
            throw new Error("User not found");
        }

        if (admin.mustChangePassword) {
            // First login: current password optional (already authenticated)
            if (input.currentPassword) {
                const valid = await bcrypt.compare(
                    input.currentPassword,
                    admin.password
                );
                if (!valid) {
                    throw new Error("Current password is incorrect");
                }
            }
        } else {
            if (!input.currentPassword) {
                throw new Error("Current password is required");
            }
            const valid = await bcrypt.compare(
                input.currentPassword,
                admin.password
            );
            if (!valid) {
                throw new Error("Current password is incorrect");
            }
        }

        const password = await hashPassword(input.newPassword);
        const [updated] = await db
            .update(superAdmins)
            .set({
                password,
                mustChangePassword: false,
                updatedAt: new Date(),
            })
            .where(eq(superAdmins.id, admin.id))
            .returning();

        const token = buildSuperAdminToken(updated, false);

        return {
            message: "Password updated successfully",
            mustChangePassword: false,
            token,
            user: omitPassword(updated),
        };
    }

    const [employee] = await db
        .select()
        .from(employees)
        .where(eq(employees.id, input.userId));

    if (!employee) {
        throw new Error("User not found");
    }

    if (employee.mustChangePassword) {
        if (input.currentPassword) {
            const valid = await bcrypt.compare(
                input.currentPassword,
                employee.password
            );
            if (!valid) {
                throw new Error("Current password is incorrect");
            }
        }
    } else {
        if (!input.currentPassword) {
            throw new Error("Current password is required");
        }
        const valid = await bcrypt.compare(
            input.currentPassword,
            employee.password
        );
        if (!valid) {
            throw new Error("Current password is incorrect");
        }
    }

    const password = await hashPassword(input.newPassword);
    const [updated] = await db
        .update(employees)
        .set({
            password,
            mustChangePassword: false,
            updatedAt: new Date(),
        })
        .where(eq(employees.id, employee.id))
        .returning();

    const token = await buildEmployeeToken(updated, false);

    return {
        message: "Password updated successfully",
        mustChangePassword: false,
        token,
        user: omitPassword(updated),
    };
};
