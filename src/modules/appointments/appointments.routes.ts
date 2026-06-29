import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import {
    createAppointmentHandler,
    getAppointmentByIdHandler,
    listAppointmentsHandler,
    shiftAppointmentClinicHandler,
    updateAppointmentHandler,
    updateAppointmentStatusHandler,
} from "./appointments.controller";

const router = Router();

router.use(authenticate);

router.post("/", createAppointmentHandler);
router.get("/", listAppointmentsHandler);
router.get("/:id", getAppointmentByIdHandler);
router.put("/:id", updateAppointmentHandler);
router.patch("/:id/status", updateAppointmentStatusHandler);
router.patch("/:id/shift-clinic", shiftAppointmentClinicHandler);

export default router;
