import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import {
    completeConsultationHandler,
    createConsultationHandler,
    createConsultationPrescriptionHandler,
    getConsultationHandler,
    listConsultationPatientsHandler,
    startConsultationHandler,
    updateConsultationHandler,
} from "./consultations.controller";

const router = Router();

router.use(authenticate);

router.post("/", createConsultationHandler);
router.get("/patients", listConsultationPatientsHandler);
router.get("/:id", getConsultationHandler);
router.put("/:id", updateConsultationHandler);
router.post("/:id/start", startConsultationHandler);
router.post("/:id/complete", completeConsultationHandler);
router.post("/:id/prescription", createConsultationPrescriptionHandler);

export default router;
