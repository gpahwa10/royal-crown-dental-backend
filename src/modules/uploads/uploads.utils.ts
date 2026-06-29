import { Response } from "express";
import { ZodError } from "zod";

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
    "File not found",
    "Patient not found",
    "Upload not found in storage",
]);

const FORBIDDEN_MESSAGES = new Set([
    "You cannot access files from another clinic",
    "You cannot modify files from another clinic",
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

export const assertFileClinicAccess = (
    fileClinicId: string,
    hasPlatformAccess: boolean,
    requesterClinicId?: string | null
) => {
    if (hasPlatformAccess) {
        return;
    }

    if (!requesterClinicId || fileClinicId !== requesterClinicId) {
        throw new Error("You cannot access files from another clinic");
    }
};
