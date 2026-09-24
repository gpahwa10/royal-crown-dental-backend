import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import {
    completeConsultationHandler,
    createConsultationHandler,
    createConsultationPrescriptionHandler,
    deleteConsultationHandler,
    getConsultationHandler,
    listConsultationPatientsHandler,
    startConsultationHandler,
    updateConsultationHandler,
} from "./consultations.controller";

import {
    getConsultationOdontogramHandler,
    initializeConsultationOdontogramHandler,
    updateConsultationOdontogramHandler,
    updateConsultationToothNotesHandler,
} from "../odontograms/odontograms.controller";

const router = Router();

router.use(authenticate);

router.post("/", createConsultationHandler);
router.get("/patients", listConsultationPatientsHandler);
router.get("/:id", getConsultationHandler);
router.put("/:id", updateConsultationHandler);
router.delete("/:id", deleteConsultationHandler);
router.post("/:id/start", startConsultationHandler);
router.post("/:id/complete", completeConsultationHandler);
router.post("/:id/prescription", createConsultationPrescriptionHandler);
router.post("/:id/odontogram/initialize", initializeConsultationOdontogramHandler);
router.get("/:id/odontogram", getConsultationOdontogramHandler);
router.put("/:id/odontogram", updateConsultationOdontogramHandler);
router.patch(
    "/:id/odontogram/teeth/:toothNumber/notes",
    updateConsultationToothNotesHandler
);
router.post("/:consultationId/odontogram/initialize", initializeConsultationOdontogramHandler);
router.get("/:consultationId/odontogram", getConsultationOdontogramHandler);
router.put("/:consultationId/odontogram", updateConsultationOdontogramHandler);
router.patch(
    "/:consultationId/odontogram/teeth/:toothNumber/notes",
    updateConsultationToothNotesHandler
);

export default router;
