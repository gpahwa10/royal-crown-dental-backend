import { Response } from "express";
import { ZodError } from "zod";
import {
    MAX_PRESCRIPTION_PDF_BYTES,
    PDF_MAGIC,
    PRESCRIPTION_PDF_MIME,
} from "./prescriptionSharing.constants";

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
    "Prescription file not found",
    "Share link not found",
    "Share link has expired",
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
    hasPlatformAccess: boolean,
    requesterClinicId?: string | null
) => {
    if (hasPlatformAccess) {
        return;
    }

    if (!requesterClinicId || clinicId !== requesterClinicId) {
        throw new Error("You cannot access prescriptions from another clinic");
    }
};

export const assertValidPdfUpload = (file: Express.Multer.File) => {
    if (!file) {
        throw new Error("PDF file is required");
    }

    if (file.size <= 0) {
        throw new Error("PDF file is empty");
    }

    if (file.size > MAX_PRESCRIPTION_PDF_BYTES) {
        throw new Error("PDF file must be 10 MB or smaller");
    }

    const mime = (file.mimetype || "").toLowerCase();
    if (mime && mime !== PRESCRIPTION_PDF_MIME && mime !== "application/x-pdf") {
        throw new Error("Only PDF files are allowed");
    }

    if (
        file.buffer.length < PDF_MAGIC.length ||
        !file.buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)
    ) {
        throw new Error("Invalid PDF file");
    }
};

export const buildPrescriptionObjectKey = (input: {
    clinicId: string;
    patientId: string;
    prescriptionId: string;
}) =>
    `clinics/${input.clinicId}/patients/${input.patientId}/prescriptions/${input.prescriptionId}.pdf`;

export const getPublicApiBaseUrl = () => {
    const base =
        process.env.PUBLIC_API_BASE_URL?.trim() ||
        `http://localhost:${process.env.PORT || "4000"}`;
    return base.replace(/\/$/, "");
};
