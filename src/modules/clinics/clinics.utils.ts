import { desc, eq } from "drizzle-orm";
import { Response } from "express";
import { ZodError } from "zod";
import { db } from "../../db/client";
import { clinics } from "../../db/schema/clinic";
import { AuthRequest } from "../../middleware/auth.middleware";
import { hasPlatformAdminAccess } from "../auth/auth.constants";

type DbExecutor = Pick<typeof db, "select">;

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
    "Clinic not found",
    "Clinic is not active",
]);

export const handleError = (res: Response, error: unknown) => {
    const message = getErrorMessage(error);

    const status = NOT_FOUND_MESSAGES.has(message)
        ? 404
        : message.includes("already exists") ||
            message.includes("duplicate key")
          ? 409
          : message.includes("Access denied") ||
              message.includes("cannot access")
            ? 403
            : message.includes("already inactive")
              ? 400
              : 400;

    return res.status(status).json({ success: false, message });
};

export const assertPlatformAdminAccess = (req: AuthRequest) => {
    if (!hasPlatformAdminAccess(req.employee)) {
        throw new Error("Access denied. Platform admin access required");
    }
};

export const assertClinicReadAccess = (
    req: AuthRequest,
    clinicId: string
) => {
    if (hasPlatformAdminAccess(req.employee)) {
        return;
    }

    if (!req.employee?.clinicId || req.employee.clinicId !== clinicId) {
        throw new Error("You cannot access clinics outside your assignment");
    }
};

const buildNameSlug = (name: string) =>
    name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);

export const generateClinicCode = async (
    clinicName: string,
    legacyClinicId: number,
    executor: DbExecutor = db
) => {
    const slug = buildNameSlug(clinicName);
    const baseCode = `CLINIC-${String(legacyClinicId).padStart(3, "0")}-${slug}`;

    const [existing] = await executor
        .select({ clinicCode: clinics.clinicCode })
        .from(clinics)
        .where(eq(clinics.clinicCode, baseCode));

    if (!existing) {
        return baseCode;
    }

    return `${baseCode}-${Date.now().toString().slice(-4)}`;
};

export const getNextLegacyClinicId = async (executor: DbExecutor = db) => {
    const [latest] = await executor
        .select({ legacyClinicId: clinics.legacyClinicId })
        .from(clinics)
        .orderBy(desc(clinics.legacyClinicId))
        .limit(1);

    return (latest?.legacyClinicId ?? 0) + 1;
};
