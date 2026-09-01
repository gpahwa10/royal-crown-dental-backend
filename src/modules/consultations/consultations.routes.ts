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

import {
    getConsultationOdontogramHandler,
    initializeConsultationOdontogramHandler,
    updateConsultationOdontogramHandler,
} from "../odontograms/odontograms.controller";

const router = Router();

router.use(authenticate);

router.post("/", createConsultationHandler);
router.get("/patients", listConsultationPatientsHandler);
router.get("/:id", getConsultationHandler);
router.put("/:id", updateConsultationHandler);
router.post("/:id/start", startConsultationHandler);
router.post("/:id/complete", completeConsultationHandler);
router.post("/:id/prescription", createConsultationPrescriptionHandler);
router.post("/:id/odontogram/initialize", initializeConsultationOdontogramHandler);
router.get("/:id/odontogram", getConsultationOdontogramHandler);
router.put("/:id/odontogram", updateConsultationOdontogramHandler);
router.post("/:consultationId/odontogram/initialize", initializeConsultationOdontogramHandler);
router.get("/:consultationId/odontogram", getConsultationOdontogramHandler);
router.put("/:consultationId/odontogram", updateConsultationOdontogramHandler);

export default router;
