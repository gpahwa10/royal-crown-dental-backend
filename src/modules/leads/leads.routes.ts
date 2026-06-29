import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import {
    bookLeadAppointmentHandler,
    convertLeadToPatientHandler,
    createLeadHandler,
    createPublicLeadHandler,
    getLeadByIdHandler,
    listLeadsHandler,
    updateLeadHandler,
    updateLeadStatusHandler,
} from "./leads.controller";

const router = Router();

router.post("/public", createPublicLeadHandler);

router.use(authenticate);

router.post("/", createLeadHandler);
router.get("/", listLeadsHandler);
router.get("/:id", getLeadByIdHandler);
router.patch("/:id/status", updateLeadStatusHandler);
router.put("/:id", updateLeadHandler);
router.post("/:id/book-appointment", bookLeadAppointmentHandler);
router.post("/:id/convert-to-patient", convertLeadToPatientHandler);

export default router;
