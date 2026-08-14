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
    "Prescription not found",
    "Consultation not found",
    "Patient not found",
]);

const FORBIDDEN_MESSAGES = new Set([
    "You cannot access prescriptions from another clinic",
    "You cannot modify prescriptions from another clinic",
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

export const assertPrescriptionClinicAccess = (
    clinicId: string,
    _hasPlatformAccess: boolean,
    requesterClinicId?: string | null
) => {
    if (!requesterClinicId || clinicId !== requesterClinicId) {
        throw new Error("You cannot access prescriptions from another clinic");
    }
};
