import { Response } from "express";
import { desc, like } from "drizzle-orm";
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
        .where(like(patients.patientCode, `${PATIENT_CODE_PREFIX}%`))
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
    _hasPlatformAccess: boolean,
    requesterClinicId?: string | null
) => {
    if (!requesterClinicId || patientClinicId !== requesterClinicId) {
        throw new Error("You cannot access patients from another clinic");
    }
};

const toCamelCaseKey = (key: string) => {
    const trimmed = key.trim();
    if (!trimmed.includes("_")) {
        return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
    }

    return trimmed
        .toLowerCase()
        .replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());
};

const emptyToUndefined = (value: unknown) => {
    if (value === undefined || value === null) {
        return undefined;
    }

    if (typeof value === "string" && value.trim() === "") {
        return undefined;
    }

    return value;
};

const parseBulkBoolean = (value: unknown, defaultValue: boolean) => {
    if (value === undefined || value === null || value === "") {
        return defaultValue;
    }

    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["true", "1", "yes", "y"].includes(normalized)) {
            return true;
        }
        if (["false", "0", "no", "n"].includes(normalized)) {
            return false;
        }
    }

    return defaultValue;
};

const toStringArray = (value: unknown) => {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }

    if (Array.isArray(value)) {
        return value
            .map((item) => (typeof item === "string" ? item.trim() : String(item)))
            .filter(Boolean);
    }

    if (typeof value === "string") {
        return value
            .split(/[|,;]/)
            .map((part) => part.trim())
            .filter(Boolean);
    }

    return undefined;
};

/**
 * Normalize a bulk-import row before createPatientSchema validation.
 * Accepts snake_case keys, defaults missing consents to true, and cleans empty optionals.
 */
export const normalizeBulkPatientRow = (
    row: Record<string, unknown>
): Record<string, unknown> => {
    const aliased: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row)) {
        const normalizedKey = toCamelCaseKey(key);
        if (aliased[normalizedKey] === undefined) {
            aliased[normalizedKey] = value;
        }
    }

    const patientTypeRaw = emptyToUndefined(aliased.patientType);
    const patientType =
        typeof patientTypeRaw === "string"
            ? patientTypeRaw.trim().toLowerCase()
            : patientTypeRaw;

    const pregnancyStatus = emptyToUndefined(aliased.pregnancyStatus);
    const dentalAnxiety = emptyToUndefined(aliased.dentalAnxiety);

    return {
        ...aliased,
        patientType,
        email: emptyToUndefined(aliased.email),
        gender: emptyToUndefined(aliased.gender),
        dateOfBirth: emptyToUndefined(aliased.dateOfBirth),
        address: emptyToUndefined(aliased.address),
        emergencyContactName: emptyToUndefined(aliased.emergencyContactName),
        emergencyContactPhone: emptyToUndefined(aliased.emergencyContactPhone),
        emergencyContactRelation: emptyToUndefined(
            aliased.emergencyContactRelation
        ),
        allergies: toStringArray(aliased.allergies),
        currentMedications: toStringArray(aliased.currentMedications),
        chronicConditions: toStringArray(aliased.chronicConditions),
        pregnancyStatus,
        dentalAnxiety,
        lastDentalVisit: emptyToUndefined(aliased.lastDentalVisit),
        lastXrayDate: emptyToUndefined(aliased.lastXrayDate),
        primaryPhysicianName: emptyToUndefined(aliased.primaryPhysicianName),
        primaryPhysicianPhone: emptyToUndefined(aliased.primaryPhysicianPhone),
        initialChiefComplaint: emptyToUndefined(aliased.initialChiefComplaint),
        // Bulk migration CSVs often omit consent columns — default to accepted.
        treatmentConsentSigned: parseBulkBoolean(
            aliased.treatmentConsentSigned,
            true
        ),
        privacyAccepted: parseBulkBoolean(aliased.privacyAccepted, true),
    };
};
