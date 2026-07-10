import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import {
    getAlertsAnalytics,
    getAppointmentsAnalytics,
    getDashboardAnalytics,
    getLeadsAnalytics,
    getPatientsAnalytics,
    getPaymentsAnalytics,
    getRevenueAnalytics,
} from "./analytics.service";
import {
    analyticsFiltersSchema,
    dashboardAnalyticsQuerySchema,
} from "./analytics.validation";
import { handleAnalyticsError } from "./analytics.utils";

export const getDashboardAnalyticsHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const query = dashboardAnalyticsQuerySchema.parse(req.query);
        const filters = analyticsFiltersSchema.parse({
            ...query,
            employee: req.employee,
        });

        const data = await getDashboardAnalytics(filters);

        return res.status(200).json({ success: true, data });
    } catch (error) {
        return handleAnalyticsError(res, error);
    }
};

export const getRevenueAnalyticsHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const filters = analyticsFiltersSchema.parse({
            ...req.query,
            employee: req.employee,
        });

        const data = await getRevenueAnalytics(filters);

        return res.status(200).json({ success: true, data });
    } catch (error) {
        return handleAnalyticsError(res, error);
    }
};

export const getPaymentsAnalyticsHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const filters = analyticsFiltersSchema.parse({
            ...req.query,
            employee: req.employee,
        });

        const data = await getPaymentsAnalytics(filters);

        return res.status(200).json({ success: true, data });
    } catch (error) {
        return handleAnalyticsError(res, error);
    }
};

export const getPatientsAnalyticsHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const filters = analyticsFiltersSchema.parse({
            ...req.query,
            employee: req.employee,
        });

        const data = await getPatientsAnalytics(filters);

        return res.status(200).json({ success: true, data });
    } catch (error) {
        return handleAnalyticsError(res, error);
    }
};

export const getLeadsAnalyticsHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const filters = analyticsFiltersSchema.parse({
            ...req.query,
            employee: req.employee,
        });

        const data = await getLeadsAnalytics(filters);

        return res.status(200).json({ success: true, data });
    } catch (error) {
        return handleAnalyticsError(res, error);
    }
};

export const getAppointmentsAnalyticsHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const filters = analyticsFiltersSchema.parse({
            ...req.query,
            employee: req.employee,
        });

        const data = await getAppointmentsAnalytics(filters);

        return res.status(200).json({ success: true, data });
    } catch (error) {
        return handleAnalyticsError(res, error);
    }
};

export const getAlertsAnalyticsHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const filters = analyticsFiltersSchema.parse({
            ...req.query,
            employee: req.employee,
        });

        const data = await getAlertsAnalytics(filters);

        return res.status(200).json({ success: true, data });
    } catch (error) {
        return handleAnalyticsError(res, error);
    }
};

