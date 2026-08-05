import { Response } from "express";
import { ZodError } from "zod";
import {
    ComparisonPeriod,
    DateRangeInfo,
    GroupByUnit,
    GrowthMetric,
} from "./analytics.types";
import { hasPlatformAdminAccess } from "../auth/auth.constants";
import { AuthRequest } from "../../middleware/auth.middleware";

export const handleAnalyticsError = (res: Response, error: unknown) => {
    if (error instanceof ZodError) {
        const message = error.issues
            .map((issue) => {
                const path = issue.path.length
                    ? `${issue.path.join(".")}: `
                    : "";
                return `${path}${issue.message}`;
            })
            .join("; ");

        return res.status(400).json({ success: false, message });
    }

    const message =
        error instanceof Error ? error.message : "Something went wrong";

    const status =
        message.includes("not configured") ||
        message.toLowerCase().includes("access denied")
            ? 400
            : 400;

    return res.status(status).json({ success: false, message });
};

export interface EffectiveScope {
    clinicId?: string;
    doctorId?: string;
    isPlatformAdmin: boolean;
}

export const resolveEffectiveScope = (params: {
    req: AuthRequest;
    clinicId?: string;
    doctorId?: string;
}): EffectiveScope => {
    const { req } = params;
    const isPlatformAdmin = hasPlatformAdminAccess(req.employee);

    const resolvedClinicId = isPlatformAdmin
        ? params.clinicId ?? req.employee?.clinicId ?? undefined
        : req.employee?.clinicId;

    let resolvedDoctorId = params.doctorId;

    const roles = req.employee?.roles ?? [];
    if (
        !isPlatformAdmin &&
        roles.includes("Doctor") &&
        !roles.includes("FDE") &&
        !roles.includes("Reception") &&
        !roles.includes("Assistant") &&
        !params.doctorId
    ) {
        resolvedDoctorId = req.employee?.id;
    }

    return {
        clinicId: resolvedClinicId ?? undefined,
        doctorId: resolvedDoctorId ?? undefined,
        isPlatformAdmin,
    };
};

export const resolveDateRange = (options: {
    startDate?: string;
    endDate?: string;
    datePreset: string;
    comparisonPeriod: ComparisonPeriod;
}): DateRangeInfo => {
    const now = new Date();

    let start: Date;
    let end: Date;

    if (options.startDate && options.endDate) {
        start = new Date(options.startDate);
        end = new Date(options.endDate);
    } else {
        const preset = options.datePreset;
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const startOfWeek = (date: Date) => {
            const d = new Date(date);
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            return new Date(d.setDate(diff));
        };

        const endOfWeek = (date: Date) => {
            const s = startOfWeek(date);
            return new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6, 23, 59, 59, 999);
        };

        const startOfMonth = (date: Date) =>
            new Date(date.getFullYear(), date.getMonth(), 1);
        const endOfMonth = (date: Date) =>
            new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

        const startOfYear = (date: Date) =>
            new Date(date.getFullYear(), 0, 1);
        const endOfYear = (date: Date) =>
            new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);

        switch (preset) {
            case "today":
                start = today;
                end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
                break;
            case "yesterday": {
                const y = new Date(today);
                y.setDate(y.getDate() - 1);
                start = y;
                end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
                break;
            }
            case "this_week":
                start = startOfWeek(today);
                end = endOfWeek(today);
                break;
            case "last_week": {
                const lastWeekStart = startOfWeek(today);
                lastWeekStart.setDate(lastWeekStart.getDate() - 7);
                const lastWeekEnd = new Date(lastWeekStart);
                lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
                end = new Date(
                    lastWeekEnd.getFullYear(),
                    lastWeekEnd.getMonth(),
                    lastWeekEnd.getDate(),
                    23,
                    59,
                    59,
                    999
                );
                start = lastWeekStart;
                break;
            }
            case "this_month":
                start = startOfMonth(today);
                end = endOfMonth(today);
                break;
            case "last_month": {
                const lastMonthDate = new Date(
                    today.getFullYear(),
                    today.getMonth() - 1,
                    1
                );
                start = startOfMonth(lastMonthDate);
                end = endOfMonth(lastMonthDate);
                break;
            }
            case "this_year":
                start = startOfYear(today);
                end = endOfYear(today);
                break;
            default:
                start = startOfMonth(today);
                end = endOfMonth(today);
        }
    }

    let comparisonStartDate: Date | undefined;
    let comparisonEndDate: Date | undefined;

    if (options.comparisonPeriod !== "none") {
        const durationMs = end.getTime() - start.getTime();

        if (options.comparisonPeriod === "previous_period") {
            comparisonEndDate = new Date(start.getTime() - 1);
            comparisonStartDate = new Date(
                comparisonEndDate.getTime() - durationMs
            );
        } else if (options.comparisonPeriod === "previous_year") {
            comparisonStartDate = new Date(
                start.getFullYear() - 1,
                start.getMonth(),
                start.getDate()
            );
            comparisonEndDate = new Date(
                end.getFullYear() - 1,
                end.getMonth(),
                end.getDate(),
                end.getHours(),
                end.getMinutes(),
                end.getSeconds(),
                end.getMilliseconds()
            );
        }
    }

    return {
        startDate: start,
        endDate: end,
        comparisonStartDate,
        comparisonEndDate,
    };
};

export const computeGrowthMetric = (params: {
    current: number;
    previous: number;
}): GrowthMetric => {
    const { current, previous } = params;
    const difference = current - previous;

    let percentage = 0;
    if (previous !== 0) {
        percentage = (difference / Math.abs(previous)) * 100;
    } else if (current !== 0) {
        percentage = 100;
    }

    return {
        current,
        previous,
        difference,
        percentage,
    };
};

export const inferGroupByUnit = (range: DateRangeInfo): GroupByUnit => {
    const days =
        (range.endDate.getTime() - range.startDate.getTime()) /
        (1000 * 60 * 60 * 24);

    if (days <= 31) {
        return "day";
    }
    if (days <= 120) {
        return "week";
    }
    if (days <= 365) {
        return "month";
    }
    if (days <= 365 * 2) {
        return "quarter";
    }
    return "year";
};

