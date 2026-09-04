import { Response } from "express";
import { desc, like } from "drizzle-orm";
import { ZodError } from "zod";
import { db } from "../../db/client";
import { consultations } from "../../db/schema/consultations";
import {
    CONSULTATION_CODE_PAD_LENGTH,
    CONSULTATION_CODE_PREFIX,
} from "./consultations.constants";

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
    "Consultation not found",
    "Patient not found",
    "Doctor not found",
    "Clinic not found",
    "Appointment not found",
    "Prescription not found",
]);

const FORBIDDEN_MESSAGES = new Set([
    "You cannot access consultations from another clinic",
    "You cannot modify consultations from another clinic",
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

type DbExecutor = Pick<typeof db, "select">;

export const generateConsultationCode = async (executor: DbExecutor = db) => {
    // Only consider canonical codes (CON000001). Ignore test / legacy rows
    // like C_TEST_... which sort above CON* lexicographically and break parseInt.
    const [latest] = await executor
        .select({ consultationCode: consultations.consultationCode })
        .from(consultations)
        .where(like(consultations.consultationCode, `${CONSULTATION_CODE_PREFIX}%`))
        .orderBy(desc(consultations.consultationCode))
        .limit(1);

    if (!latest?.consultationCode) {
        return `${CONSULTATION_CODE_PREFIX}${String(1).padStart(CONSULTATION_CODE_PAD_LENGTH, "0")}`;
    }

    const match = latest.consultationCode.match(
        new RegExp(`^${CONSULTATION_CODE_PREFIX}(\\d+)$`)
    );
    const sequence = match ? Number.parseInt(match[1], 10) : Number.NaN;

    if (Number.isNaN(sequence)) {
        throw new Error("Unable to generate consultation code");
    }

    return `${CONSULTATION_CODE_PREFIX}${String(sequence + 1).padStart(CONSULTATION_CODE_PAD_LENGTH, "0")}`;
};

export const assertConsultationClinicAccess = (
    consultationClinicId: string,
    _hasPlatformAccess: boolean,
    requesterClinicId?: string | null
) => {
    if (!requesterClinicId || consultationClinicId !== requesterClinicId) {
        throw new Error("You cannot access consultations from another clinic");
    }
};
