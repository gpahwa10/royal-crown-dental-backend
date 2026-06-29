import { Response } from "express";
import { desc } from "drizzle-orm";
import { ZodError } from "zod";
import { db } from "../../db/client";
import { dentalLabOrders } from "../../db/schema/dentalLabOrders";
import {
    DENTAL_LAB_ORDER_CODE_PAD_LENGTH,
    DENTAL_LAB_ORDER_CODE_PREFIX,
} from "./dentalLab.constants";

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
    "Dental lab order not found",
    "Patient not found",
    "Doctor not found",
    "Clinic not found",
    "Consultation not found",
    "Appointment not found",
    "File not found",
]);

const FORBIDDEN_MESSAGES = new Set([
    "You cannot access dental lab orders from another clinic",
    "You cannot modify dental lab orders from another clinic",
]);

export const handleError = (res: Response, error: unknown) => {
    const message = getErrorMessage(error);

    const status = NOT_FOUND_MESSAGES.has(message)
        ? 404
        : FORBIDDEN_MESSAGES.has(message)
          ? 403
          : message.includes("already exists") ||
              message.includes("duplicate key") ||
              message.includes("Duplicate attachment") ||
              message.includes("Appointment already exists")
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

export const generateDentalLabOrderCode = async (executor: DbExecutor = db) => {
    const [latest] = await executor
        .select({ orderCode: dentalLabOrders.orderCode })
        .from(dentalLabOrders)
        .orderBy(desc(dentalLabOrders.orderCode))
        .limit(1);

    if (!latest?.orderCode) {
        return `${DENTAL_LAB_ORDER_CODE_PREFIX}${String(1).padStart(DENTAL_LAB_ORDER_CODE_PAD_LENGTH, "0")}`;
    }

    const sequence = Number.parseInt(
        latest.orderCode.replace(DENTAL_LAB_ORDER_CODE_PREFIX, ""),
        10
    );

    if (Number.isNaN(sequence)) {
        throw new Error("Unable to generate dental lab order code");
    }

    return `${DENTAL_LAB_ORDER_CODE_PREFIX}${String(sequence + 1).padStart(DENTAL_LAB_ORDER_CODE_PAD_LENGTH, "0")}`;
};

export const assertDentalLabOrderClinicAccess = (
    orderClinicId: string,
    hasPlatformAccess: boolean,
    requesterClinicId?: string | null
) => {
    if (hasPlatformAccess) {
        return;
    }

    if (!requesterClinicId || orderClinicId !== requesterClinicId) {
        throw new Error(
            "You cannot access dental lab orders from another clinic"
        );
    }
};
