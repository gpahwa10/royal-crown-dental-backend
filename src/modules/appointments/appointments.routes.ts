import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import {
    createAppointmentHandler,
    getAppointmentByIdHandler,
    listAppointmentsHandler,
    listAvailableDoctorsHandler,
    shiftAppointmentClinicHandler,
    updateAppointmentHandler,
    updateAppointmentStatusHandler,
} from "./appointments.controller";

const router = Router();

router.use(authenticate);

router.post("/", createAppointmentHandler);
router.get("/", listAppointmentsHandler);
router.get("/available-doctors", listAvailableDoctorsHandler);
router.get("/:id", getAppointmentByIdHandler);
router.put("/:id", updateAppointmentHandler);
router.patch("/:id/status", updateAppointmentStatusHandler);
router.patch("/:id/shift-clinic", shiftAppointmentClinicHandler);

export default router;
