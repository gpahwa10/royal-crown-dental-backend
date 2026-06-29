import { Response } from "express";
import { desc } from "drizzle-orm";
import { ZodError } from "zod";
import { db } from "../../db/client";
import { appointments } from "../../db/schema/appointments";
import {
    APPOINTMENT_CODE_PAD_LENGTH,
    APPOINTMENT_CODE_PREFIX,
} from "./appointments.constants";

export const getErrorMessage = (error: unknown) => {
    if (error instanceof ZodError) {
        return error.issues
            .map((issue) => {
                const path = issue.path.length
                    ? `${issue.path.join(".")}: `
                    : "";
                return `${path}${issue.message}`;
            })
            .join("; ");
    }

    if (!(error instanceof Error)) {
        return "Something went wrong";
    }

    const cause = (error as Error & { cause?: Error }).cause;
    if (cause?.message) {
        return cause.message;
    }

    return error.message;
};

const NOT_FOUND_MESSAGES = new Set([
    "Appointment not found",
    "Clinic not found",
    "Employee not found",
    "Patient not found",
    "Lead not found",
]);

const FORBIDDEN_MESSAGES = new Set([
    "You cannot access appointments from another clinic",
    "You cannot modify appointments from another clinic",
    "You cannot shift appointments for another clinic",
]);

export const handleError = (res: Response, error: unknown) => {
    const message = getErrorMessage(error);

    const status = NOT_FOUND_MESSAGES.has(message)
        ? 404
        : FORBIDDEN_MESSAGES.has(message)
          ? 403
          : message.includes("already exists") ||
              message.includes("duplicate key")
            ? 409
            : 400;

    return res.status(status).json({ success: false, message });
};

export const getPagination = (page?: number, limit?: number) => {
    const resolvedPage = Math.max(1, page ?? 1);
    const resolvedLimit = Math.min(100, Math.max(1, limit ?? 10));
    return {
        page: resolvedPage,
        limit: resolvedLimit,
        offset: (resolvedPage - 1) * resolvedLimit,
    };
};

export const buildPaginationMeta = (
    page: number,
    limit: number,
    total: number
) => ({
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
});

export const buildScheduledAt = (
    scheduledAt?: Date,
    appointmentDate?: string,
    appointmentTime?: string
): Date => {
    if (scheduledAt) {
        return scheduledAt;
    }

    if (!appointmentDate || !appointmentTime) {
        throw new Error(
            "scheduledAt or appointmentDate and appointmentTime are required"
        );
    }

    const [year, month, day] = appointmentDate.split("-").map(Number);
    const [hours, minutes] = appointmentTime.split(":").map(Number);

    return new Date(year, month - 1, day, hours, minutes);
};

export const endOfDay = (date: Date) => {
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return end;
};

type DbExecutor = Pick<typeof db, "select">;

export const generateAppointmentCode = async (executor: DbExecutor = db) => {
    const [latest] = await executor
        .select({ appointmentCode: appointments.appointmentCode })
        .from(appointments)
        .orderBy(desc(appointments.appointmentCode))
        .limit(1);

    if (!latest?.appointmentCode) {
        return `${APPOINTMENT_CODE_PREFIX}${String(1).padStart(APPOINTMENT_CODE_PAD_LENGTH, "0")}`;
    }

    const sequence = Number.parseInt(
        latest.appointmentCode.replace(APPOINTMENT_CODE_PREFIX, ""),
        10
    );

    if (Number.isNaN(sequence)) {
        throw new Error("Unable to generate appointment code");
    }

    return `${APPOINTMENT_CODE_PREFIX}${String(sequence + 1).padStart(APPOINTMENT_CODE_PAD_LENGTH, "0")}`;
};
