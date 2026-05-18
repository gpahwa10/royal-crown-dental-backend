import { db } from "db/client";
import { employees } from "db/schema/employees";
import { employeeRoles } from "db/schema/roles";
import { superAdmins } from "db/schema/superAdmins";
import { eq, count } from "drizzle-orm";
import bcrypt from "bcrypt";
import { generateToken } from "../../utils/generateToken";
import {
    EmployeeRole,
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

const getRoleNameById = async (roleId: string) => {
    const [role] = await db
        .select({ name: employeeRoles.name })
        .from(employeeRoles)
        .where(eq(employeeRoles.id, roleId));

    if (!role) {
        throw new Error("Employee role is not configured");
    }

    return role.name;
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
    const roleName = await getRoleNameById(employee.roleId);

    return generateToken({
        userId: employee.id,
        clinicId: employee.clinicId,
        roles: [roleName],
        isSuperAdmin: false,
    });
};

export interface RegisterEmployeeInput {
    clinicId: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone: string;
    designation: string;
    role: EmployeeRole;
}

export interface CreateSuperAdminInput {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
}

export const staffLogin = async (email: string, password: string) => {
    const [employee] = await db
        .select()
        .from(employees)
        .where(eq(employees.email, email));

    if (!employee) {
        throw new Error("Invalid credentials");
    }

    assertEmployeeCanLogin(employee);

    const isPasswordValid = await bcrypt.compare(password, employee.password);
    if (!isPasswordValid) {
        throw new Error("Invalid credentials");
    }

    const token = await buildEmployeeToken(employee);

    return {
        employee: omitPassword(employee),
        token,
    };
};

const registerEmployee = async (input: RegisterEmployeeInput) => {
    const role = await getRoleByName(input.role);

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
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email,
            password: hashedPassword,
            phone: input.phone,
            designation: input.designation,
            roleId: role.id,
        })
        .returning();

    return { employee: omitPassword(employee) };
};

export const registerStaff = (input: RegisterEmployeeInput) =>
    registerEmployee(input);

export const registerHR = (input: RegisterEmployeeInput) =>
    registerEmployee(input);

export const superAdminLogin = async (email: string, password: string) => {
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
        userId: admin.id,
        clinicId: null,
        roles: [],
        isSuperAdmin: true,
    });

    return {
        superAdmin: omitPassword(admin),
        token,
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
