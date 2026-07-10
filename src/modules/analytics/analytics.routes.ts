import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import {
    getDashboardAnalyticsHandler,
    getRevenueAnalyticsHandler,
    getPaymentsAnalyticsHandler,
    getPatientsAnalyticsHandler,
    getLeadsAnalyticsHandler,
    getAppointmentsAnalyticsHandler,
    getAlertsAnalyticsHandler,
} from "./analytics.controller";

const router = Router();

router.use(authenticate);

router.get("/dashboard", getDashboardAnalyticsHandler);
router.get("/revenue", getRevenueAnalyticsHandler);
router.get("/payments", getPaymentsAnalyticsHandler);
router.get("/patients", getPatientsAnalyticsHandler);
router.get("/leads", getLeadsAnalyticsHandler);
router.get("/appointments", getAppointmentsAnalyticsHandler);
router.get("/alerts", getAlertsAnalyticsHandler);

export default router;

