import { Response } from "express";
import { desc } from "drizzle-orm";
import { ZodError } from "zod";
import { db } from "../../db/client";
import { invoices } from "../../db/schema/invoices";
import {
    hasPlatformAdminAccess,
    ROLE_ASSISTANT,
    ROLE_DOCTOR,
    ROLE_RECEPTION,
} from "../auth/auth.constants";
import { AuthRequest } from "../../middleware/auth.middleware";
import {
    INVOICE_NUMBER_PAD_LENGTH,
    INVOICE_NUMBER_PREFIX,
} from "./billing.constants";

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

    return error.message;
};

const NOT_FOUND_MESSAGES = new Set([
    "Invoice not found",
    "Patient not found",
    "Clinic not found",
    "Service not found",
    "Payment not found",
]);

const FORBIDDEN_MESSAGES = new Set([
    "You cannot access invoices from another clinic",
    "Doctors have read-only access to financial records",
]);

export const handleError = (res: Response, error: unknown) => {
    const message = getErrorMessage(error);

    const status = NOT_FOUND_MESSAGES.has(message)
        ? 404
        : FORBIDDEN_MESSAGES.has(message)
          ? 403
          : message.includes("already paid") ||
              message.includes("Duplicate") ||
              message.includes("duplicate key") ||
              message.includes("already exists")
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

export const generateInvoiceNumber = async (executor: DbExecutor = db) => {
    const [latest] = await executor
        .select({ invoiceNumber: invoices.invoiceNumber })
        .from(invoices)
        .orderBy(desc(invoices.invoiceNumber))
        .limit(1);

    if (!latest?.invoiceNumber) {
        return `${INVOICE_NUMBER_PREFIX}${String(1).padStart(INVOICE_NUMBER_PAD_LENGTH, "0")}`;
    }

    const sequence = Number.parseInt(
        latest.invoiceNumber.replace(INVOICE_NUMBER_PREFIX, ""),
        10
    );

    if (Number.isNaN(sequence)) {
        throw new Error("Unable to generate invoice number");
    }

    return `${INVOICE_NUMBER_PREFIX}${String(sequence + 1).padStart(INVOICE_NUMBER_PAD_LENGTH, "0")}`;
};

export const assertFinancialWriteAccess = (req: AuthRequest) => {
    if (hasPlatformAdminAccess(req.employee)) {
        return;
    }

    const roles = req.employee?.roles ?? [];
    if (
        roles.includes(ROLE_DOCTOR) &&
        !roles.includes(ROLE_RECEPTION) &&
        !roles.includes(ROLE_ASSISTANT)
    ) {
        throw new Error("Doctors have read-only access to financial records");
    }
};

export const assertInvoiceClinicAccess = (
    invoiceClinicId: string,
    hasPlatformAccess: boolean,
    requesterClinicId?: string | null
) => {
    if (hasPlatformAccess) {
        return;
    }

    if (!requesterClinicId || invoiceClinicId !== requesterClinicId) {
        throw new Error("You cannot access invoices from another clinic");
    }
};
