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
import { CLINIC_TIMEZONE } from "../scheduling/scheduling.constants";
import {
    endOfZonedDay,
    startOfZonedDay,
    zonedYmd,
} from "../scheduling/scheduling.utils";

export { endOfZonedDay, startOfZonedDay };

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

    // Platform admins (Super Admin / Director / Retail Head):
    // - with clinicId query → that clinic only
    // - without clinicId → all clinics (do NOT fall back to employee.clinicId)
    const resolvedClinicId = isPlatformAdmin
        ? params.clinicId
        : (req.employee?.clinicId ?? undefined);

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
        clinicId: resolvedClinicId || undefined,
        doctorId: resolvedDoctorId || undefined,
        isPlatformAdmin,
    };
};

const addCalendarDays = (date: Date, days: number) =>
    new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

export const resolveDateRange = (options: {
    startDate?: string;
    endDate?: string;
    datePreset: string;
    comparisonPeriod: ComparisonPeriod;
}): DateRangeInfo => {
    const now = new Date();
    const tz = CLINIC_TIMEZONE;

    let start: Date;
    let end: Date;

    if (options.startDate && options.endDate) {
        start = new Date(options.startDate);
        end = new Date(options.endDate);
    } else {
        const todayStart = startOfZonedDay(tz, now);
        const todayEnd = endOfZonedDay(tz, now);
        const { year, month, day } = zonedYmd(tz, now);

        // Monday-start week in clinic timezone
        const weekdayName = new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            weekday: "short",
        }).format(now);
        const weekdayIndex =
            { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[
                weekdayName
            ] ?? 0;

        const startOfWeek = () => addCalendarDays(todayStart, -weekdayIndex);
        const endOfWeek = () =>
            endOfZonedDay(tz, addCalendarDays(startOfWeek(), 6));

        const startOfMonth = (y: number, m: number) =>
            startOfZonedDay(tz, new Date(Date.UTC(y, m - 1, 1, 12)));
        const endOfMonth = (y: number, m: number) => {
            // day 0 of next month = last day of m
            const lastDay = new Date(Date.UTC(y, m, 0, 12));
            return endOfZonedDay(tz, lastDay);
        };

        switch (options.datePreset) {
            case "today":
                start = todayStart;
                end = todayEnd;
                break;
            case "yesterday": {
                const y = addCalendarDays(todayStart, -1);
                start = startOfZonedDay(tz, y);
                end = endOfZonedDay(tz, y);
                break;
            }
            case "this_week":
                start = startOfWeek();
                end = endOfWeek();
                break;
            case "last_week": {
                const thisWeekStart = startOfWeek();
                start = addCalendarDays(thisWeekStart, -7);
                end = endOfZonedDay(tz, addCalendarDays(start, 6));
                break;
            }
            case "this_month":
                start = startOfMonth(year, month);
                end = endOfMonth(year, month);
                break;
            case "last_month": {
                const prevMonth = month === 1 ? 12 : month - 1;
                const prevYear = month === 1 ? year - 1 : year;
                start = startOfMonth(prevYear, prevMonth);
                end = endOfMonth(prevYear, prevMonth);
                break;
            }
            case "this_year":
                start = startOfMonth(year, 1);
                end = endOfMonth(year, 12);
                break;
            default:
                start = startOfMonth(year, month);
                end = endOfMonth(year, month);
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
                start.getDate(),
                start.getHours(),
                start.getMinutes(),
                start.getSeconds(),
                start.getMilliseconds()
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

