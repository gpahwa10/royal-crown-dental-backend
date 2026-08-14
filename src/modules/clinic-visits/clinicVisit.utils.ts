import { Response } from "express";
import { desc } from "drizzle-orm";
import { ZodError } from "zod";
import { db } from "../../db/client";
import { clinicVisits } from "../../db/schema/clinicVisits";
import {
    CLINIC_VISIT_NUMBER_PAD_LENGTH,
    CLINIC_VISIT_NUMBER_PREFIX,
} from "./clinicVisit.constants";

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
    "Clinic not found",
    "Clinic visit not found",
    "Patient not found",
    "Lead not found",
    "Doctor not found",
    "Appointment not found",
    "Consultation not found",
    "Invoice not found",
    "Membership not found",
    "Membership plan not found",
    "File not found",
]);

const FORBIDDEN_MESSAGES = new Set([
    "You cannot access clinic visits from another clinic",
    "Doctors have read-only access to clinic visit records",
    "You can only access visits assigned to you",
]);

const CONFLICT_MESSAGES = new Set([
    "Duplicate check-in",
    "Already checked out",
    "Visit is already completed",
    "Visit is cancelled",
]);

export const handleError = (res: Response, error: unknown) => {
    const message = getErrorMessage(error);

    const status = NOT_FOUND_MESSAGES.has(message)
        ? 404
        : FORBIDDEN_MESSAGES.has(message)
          ? 403
          : CONFLICT_MESSAGES.has(message)
            ? 409
            : 400;

    return res.status(status).json({ success: false, message });
};

export const getPagination = (page?: number, limit?: number) => {
    const resolvedPage = Math.max(1, page ?? 1);
    const resolvedLimit = Math.min(100, Math.max(1, limit ?? 20));
    return {
        page: resolvedPage,
        limit: resolvedLimit,
        offset: (resolvedPage - 1) * resolvedLimit,
    };
};

type DbExecutor = Pick<typeof db, "select">;

export const generateVisitNumber = async (executor: DbExecutor = db) => {
    const [latest] = await executor
        .select({ visitNumber: clinicVisits.visitNumber })
        .from(clinicVisits)
        .orderBy(desc(clinicVisits.visitNumber))
        .limit(1);

    if (!latest?.visitNumber) {
        return `${CLINIC_VISIT_NUMBER_PREFIX}${String(1).padStart(
            CLINIC_VISIT_NUMBER_PAD_LENGTH,
            "0"
        )}`;
    }

    const sequence = Number.parseInt(
        latest.visitNumber.replace(CLINIC_VISIT_NUMBER_PREFIX, ""),
        10
    );

    if (Number.isNaN(sequence)) {
        throw new Error("Unable to generate visit number");
    }

    return `${CLINIC_VISIT_NUMBER_PREFIX}${String(sequence + 1).padStart(
        CLINIC_VISIT_NUMBER_PAD_LENGTH,
        "0"
    )}`;
};

export const startOfDay = (date: Date) => {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
};

export const endOfDay = (date: Date) => {
    const value = new Date(date);
    value.setHours(23, 59, 59, 999);
    return value;
};

export const assertClinicVisitClinicAccess = (
    visitClinicId: string,
    _hasPlatformAccess: boolean,
    requesterClinicId?: string | null
) => {
    if (!requesterClinicId || visitClinicId !== requesterClinicId) {
        throw new Error("You cannot access clinic visits from another clinic");
    }
};
