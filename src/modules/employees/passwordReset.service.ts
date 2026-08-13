import { and, desc, eq, sql } from "drizzle-orm";
import bcrypt from "bcrypt";
import { db } from "../../db/client";
import { clinics } from "../../db/schema/clinic";
import { employees } from "../../db/schema/employees";
import { passwordResetRequests } from "../../db/schema/passwordResetRequests";
import { superAdmins } from "../../db/schema/superAdmins";
import { SALT_ROUNDS } from "../auth/auth.constants";
import { DEFAULT_EMPLOYEE_PASSWORD } from "./employees.service";

export type PasswordResetRequestStatus = "pending" | "approved" | "rejected";

const GENERIC_FORGOT_MESSAGE =
    "If this email is registered, a reset request has been sent to Super Admin, Director, or HR.";

const hashPassword = (password: string) => bcrypt.hash(password, SALT_ROUNDS);

const findEmployeeByEmail = async (email: string) => {
    const [employee] = await db
        .select()
        .from(employees)
        .where(sql`lower(${employees.email}) = ${email.toLowerCase()}`)
        .limit(1);
    return employee ?? null;
};

const resolveActorName = async (actor: {
    id: string;
    isSuperAdmin?: boolean;
}) => {
    if (actor.isSuperAdmin) {
        const [admin] = await db
            .select({ name: superAdmins.name })
            .from(superAdmins)
            .where(eq(superAdmins.id, actor.id))
            .limit(1);
        return admin?.name ?? "Super Admin";
    }
    const [employee] = await db
        .select({ name: employees.name })
        .from(employees)
        .where(eq(employees.id, actor.id))
        .limit(1);
    return employee?.name ?? "Staff";
};

export const requestPasswordReset = async (input: { email: string; note?: string }) => {
    const email = input.email.trim().toLowerCase();
    const employee = await findEmployeeByEmail(email);

    if (!employee) {
        return { message: GENERIC_FORGOT_MESSAGE };
    }

    const [existing] = await db
        .select({ id: passwordResetRequests.id })
        .from(passwordResetRequests)
        .where(
            and(
                eq(passwordResetRequests.employeeId, employee.id),
                eq(passwordResetRequests.status, "pending"),
            ),
        )
        .limit(1);

    if (existing) {
        return { message: GENERIC_FORGOT_MESSAGE };
    }

    await db.insert(passwordResetRequests).values({
        employeeId: employee.id,
        email: employee.email,
        name: employee.name,
        clinicId: employee.clinicId,
        note: input.note?.trim() || null,
        status: "pending",
    });

    return { message: GENERIC_FORGOT_MESSAGE };
};

export const listPasswordResetRequests = async (status?: PasswordResetRequestStatus) => {
    const rows = await db
        .select({
            id: passwordResetRequests.id,
            employeeId: passwordResetRequests.employeeId,
            email: passwordResetRequests.email,
            name: passwordResetRequests.name,
            clinicId: passwordResetRequests.clinicId,
            clinicName: clinics.clinicName,
            note: passwordResetRequests.note,
            status: passwordResetRequests.status,
            resolvedAt: passwordResetRequests.resolvedAt,
            resolvedById: passwordResetRequests.resolvedById,
            resolvedByName: passwordResetRequests.resolvedByName,
            createdAt: passwordResetRequests.createdAt,
            updatedAt: passwordResetRequests.updatedAt,
            designation: employees.designation,
        })
        .from(passwordResetRequests)
        .leftJoin(employees, eq(employees.id, passwordResetRequests.employeeId))
        .leftJoin(clinics, eq(clinics.id, passwordResetRequests.clinicId))
        .where(status ? eq(passwordResetRequests.status, status) : sql`true`)
        .orderBy(desc(passwordResetRequests.createdAt));

    return rows;
};

const getPendingRequest = async (id: string) => {
    const [request] = await db
        .select()
        .from(passwordResetRequests)
        .where(eq(passwordResetRequests.id, id))
        .limit(1);

    if (!request) {
        throw new Error("Reset request not found");
    }
    if (request.status !== "pending") {
        throw new Error("Reset request has already been resolved");
    }
    return request;
};

export const approvePasswordReset = async (
    id: string,
    actor: { id: string; isSuperAdmin?: boolean },
) => {
    const request = await getPendingRequest(id);
    const actorName = await resolveActorName(actor);
    const hashedPassword = await hashPassword(DEFAULT_EMPLOYEE_PASSWORD);
    const now = new Date();

    await db
        .update(employees)
        .set({
            password: hashedPassword,
            mustChangePassword: true,
            updatedAt: now,
        })
        .where(eq(employees.id, request.employeeId));

    const [updated] = await db
        .update(passwordResetRequests)
        .set({
            status: "approved",
            resolvedAt: now,
            resolvedById: actor.id,
            resolvedByName: actorName,
            updatedAt: now,
        })
        .where(eq(passwordResetRequests.id, id))
        .returning();

    return {
        request: updated,
        temporaryPassword: DEFAULT_EMPLOYEE_PASSWORD,
    };
};

export const rejectPasswordReset = async (
    id: string,
    actor: { id: string; isSuperAdmin?: boolean },
) => {
    const request = await getPendingRequest(id);
    const actorName = await resolveActorName(actor);
    const now = new Date();

    const [updated] = await db
        .update(passwordResetRequests)
        .set({
            status: "rejected",
            resolvedAt: now,
            resolvedById: actor.id,
            resolvedByName: actorName,
            updatedAt: now,
        })
        .where(eq(passwordResetRequests.id, request.id))
        .returning();

    return updated;
};
