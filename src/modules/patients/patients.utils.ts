import { Response } from "express";
import { desc } from "drizzle-orm";
import { ZodError } from "zod";
import { db } from "../../db/client";
import { patients } from "../../db/schema/patients";
import {
    PATIENT_CODE_PAD_LENGTH,
    PATIENT_CODE_PREFIX,
} from "./patients.constants";

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
    "Patient not found",
    "Clinic not found",
    "Medical profile not found",
]);

const FORBIDDEN_MESSAGES = new Set([
    "You cannot access patients from another clinic",
    "You cannot modify patients from another clinic",
]);

export const handleError = (res: Response, error: unknown) => {
    const message = getErrorMessage(error);

    const status = NOT_FOUND_MESSAGES.has(message)
        ? 404
        : FORBIDDEN_MESSAGES.has(message)
          ? 403
          : message.includes("already exists") ||
              message.includes("duplicate key") ||
              message.includes("duplicate phone")
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

export const toDate = (value?: Date | string | null) => {
    if (value === undefined || value === null) {
        return undefined;
    }

    return value instanceof Date ? value : new Date(value);
};

type DbExecutor = Pick<typeof db, "select">;

export const generatePatientCode = async (executor: DbExecutor = db) => {
    const [latest] = await executor
        .select({ patientCode: patients.patientCode })
        .from(patients)
        .orderBy(desc(patients.patientCode))
        .limit(1);

    if (!latest?.patientCode) {
        return `${PATIENT_CODE_PREFIX}${String(1).padStart(PATIENT_CODE_PAD_LENGTH, "0")}`;
    }

    const sequence = Number.parseInt(
        latest.patientCode.replace(PATIENT_CODE_PREFIX, ""),
        10
    );

    if (Number.isNaN(sequence)) {
        throw new Error("Unable to generate patient code");
    }

    return `${PATIENT_CODE_PREFIX}${String(sequence + 1).padStart(PATIENT_CODE_PAD_LENGTH, "0")}`;
};

export const assertPatientClinicAccess = (
    patientClinicId: string,
    hasPlatformAccess: boolean,
    requesterClinicId?: string | null
) => {
    if (hasPlatformAccess) {
        return;
    }

    if (!requesterClinicId || patientClinicId !== requesterClinicId) {
        throw new Error("You cannot access patients from another clinic");
    }
};
