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
    "Membership plan not found",
    "Membership benefit not found",
    "Patient membership not found",
    "Patient not found",
    "Service not found",
    "Invoice not found",
]);

const FORBIDDEN_MESSAGES = new Set([
    "Doctors have read-only access to financial records",
]);

const CONFLICT_MESSAGES = new Set([
    "Membership plan code already exists",
]);

export const handleError = (res: Response, error: unknown) => {
    const message = getErrorMessage(error);

    const status = NOT_FOUND_MESSAGES.has(message)
        ? 404
        : FORBIDDEN_MESSAGES.has(message)
          ? 403
          : CONFLICT_MESSAGES.has(message) ||
            message.includes("Duplicate") ||
            message.includes("already active") ||
            message.includes("already exists") ||
            message.includes("duplicate key")
          ? 409
          : 400;

    return res.status(status).json({ success: false, message });
};
