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

const NOT_FOUND_MESSAGES = new Set(["Patient not found", "Radiograph not found"]);

export const handleError = (res: Response, error: unknown) => {
    const message = getErrorMessage(error);
    const status = NOT_FOUND_MESSAGES.has(message) ? 404 : 400;
    return res.status(status).json({ success: false, message });
};
