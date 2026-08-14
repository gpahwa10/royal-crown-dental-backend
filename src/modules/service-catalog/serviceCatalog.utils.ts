import { Response } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { ZodError } from "zod";
import { db } from "../../db/client";
import { serviceCatalog } from "../../db/schema/serviceCatalog";
import {
    SERVICE_CODE_PAD_LENGTH,
    SERVICE_CODE_PREFIX,
} from "./serviceCatalog.constants";

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
    "Service not found",
    "Clinic not found",
]);

const FORBIDDEN_MESSAGES = new Set([
    "You cannot access services from another clinic",
    "You cannot modify services from another clinic",
    "Doctors have read-only access to financial records",
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

export const generateServiceCode = async (
    clinicId: string,
    executor: DbExecutor = db
) => {
    const [latest] = await executor
        .select({ serviceCode: serviceCatalog.serviceCode })
        .from(serviceCatalog)
        .where(eq(serviceCatalog.clinicId, clinicId))
        .orderBy(desc(serviceCatalog.serviceCode))
        .limit(1);

    if (!latest?.serviceCode) {
        return `${SERVICE_CODE_PREFIX}${String(1).padStart(SERVICE_CODE_PAD_LENGTH, "0")}`;
    }

    const match = latest.serviceCode.match(
        new RegExp(`^${SERVICE_CODE_PREFIX}(\\d+)$`)
    );

    if (!match) {
        const [countRow] = await executor
            .select({ total: sql<number>`count(*)`.mapWith(Number) })
            .from(serviceCatalog)
            .where(eq(serviceCatalog.clinicId, clinicId));

        const fallbackSequence = (countRow?.total ?? 0) + 1;
        return `${SERVICE_CODE_PREFIX}${String(fallbackSequence).padStart(SERVICE_CODE_PAD_LENGTH, "0")}`;
    }

    const sequence = Number.parseInt(match[1], 10);

    if (Number.isNaN(sequence)) {
        throw new Error("Unable to generate service code");
    }

    return `${SERVICE_CODE_PREFIX}${String(sequence + 1).padStart(SERVICE_CODE_PAD_LENGTH, "0")}`;
};

export const assertServiceCatalogClinicAccess = (
    serviceClinicId: string,
    _hasPlatformAccess: boolean,
    requesterClinicId?: string | null
) => {
    if (!requesterClinicId || serviceClinicId !== requesterClinicId) {
        throw new Error("You cannot access services from another clinic");
    }
};
