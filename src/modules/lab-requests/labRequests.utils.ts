import { Response } from "express";
import { desc } from "drizzle-orm";
import { ZodError } from "zod";
import { db } from "../../db/client";
import { labRequests } from "../../db/schema/labRequests";
import {
    LAB_REQUEST_CODE_PAD_LENGTH,
    LAB_REQUEST_CODE_PREFIX,
} from "./labRequests.constants";

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
    "Lab request not found",
    "Patient not found",
    "Doctor not found",
    "Clinic not found",
    "Consultation not found",
    "File not found",
]);

const FORBIDDEN_MESSAGES = new Set([
    "You cannot access lab requests from another clinic",
    "You cannot modify lab requests from another clinic",
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
    const resolvedLimit = Math.min(100, Math.max(1, limit ?? 20));
    return {
        page: resolvedPage,
        limit: resolvedLimit,
        offset: (resolvedPage - 1) * resolvedLimit,
    };
};

type DbExecutor = Pick<typeof db, "select">;

export const generateLabRequestCode = async (executor: DbExecutor = db) => {
    const [latest] = await executor
        .select({ labRequestCode: labRequests.labRequestCode })
        .from(labRequests)
        .orderBy(desc(labRequests.labRequestCode))
        .limit(1);

    if (!latest?.labRequestCode) {
        return `${LAB_REQUEST_CODE_PREFIX}${String(1).padStart(LAB_REQUEST_CODE_PAD_LENGTH, "0")}`;
    }

    const sequence = Number.parseInt(
        latest.labRequestCode.replace(LAB_REQUEST_CODE_PREFIX, ""),
        10
    );

    if (Number.isNaN(sequence)) {
        throw new Error("Unable to generate lab request code");
    }

    return `${LAB_REQUEST_CODE_PREFIX}${String(sequence + 1).padStart(LAB_REQUEST_CODE_PAD_LENGTH, "0")}`;
};

export const assertLabRequestClinicAccess = (
    labRequestClinicId: string,
    _hasPlatformAccess: boolean,
    requesterClinicId?: string | null
) => {
    if (!requesterClinicId || labRequestClinicId !== requesterClinicId) {
        throw new Error("You cannot access lab requests from another clinic");
    }
};
