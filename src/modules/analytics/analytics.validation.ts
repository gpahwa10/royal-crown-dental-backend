import { z } from "zod";
import { GroupByUnit, ComparisonPeriod } from "./analytics.types";

const datePresetEnum = z.enum([
    "today",
    "yesterday",
    "this_week",
    "last_week",
    "this_month",
    "last_month",
    "this_year",
    "custom",
]);

export const groupByEnum: z.ZodType<GroupByUnit> = z.enum([
    "day",
    "week",
    "month",
    "quarter",
    "year",
]);

export const comparisonPeriodEnum: z.ZodType<ComparisonPeriod> = z.enum([
    "previous_period",
    "previous_year",
    "none",
]);

export const analyticsBaseQuerySchema = z.object({
    clinicId: z.string().uuid().optional(),
    doctorId: z.string().uuid().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    datePreset: datePresetEnum.default("this_month"),
    groupBy: groupByEnum.optional(),
    comparisonPeriod: comparisonPeriodEnum.default("previous_period"),
    page: z.coerce.number().int().min(1).default(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

export const dashboardAnalyticsQuerySchema = analyticsBaseQuerySchema.omit({
    page: true,
    limit: true,
});

export const analyticsFiltersSchema = analyticsBaseQuerySchema.extend({
    employee: z
        .object({
            id: z.string(),
            clinicId: z.string().uuid().nullable().optional(),
            roles: z.array(z.string()).default([]),
            isSuperAdmin: z.boolean().optional().default(false),
        })
        .nullable()
        .optional(),
});

export type AnalyticsFiltersInput = z.infer<typeof analyticsFiltersSchema>;

