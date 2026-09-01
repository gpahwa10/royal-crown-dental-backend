import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import {
    getConsultationOdontogramHandler,
    getPatientOdontogramHandler,
    initializeConsultationOdontogramHandler,
    updateConsultationOdontogramHandler,
} from "./odontograms.controller";

export const patientOdontogramsRouter = Router();
patientOdontogramsRouter.use(authenticate);
patientOdontogramsRouter.get("/:patientId/odontogram", getPatientOdontogramHandler);

export const consultationOdontogramsRouter = Router();
consultationOdontogramsRouter.use(authenticate);
consultationOdontogramsRouter.post(
    "/:consultationId/odontogram/initialize",
    initializeConsultationOdontogramHandler
);
consultationOdontogramsRouter.get(
    "/:consultationId/odontogram",
    getConsultationOdontogramHandler
);
consultationOdontogramsRouter.put(
    "/:consultationId/odontogram",
    updateConsultationOdontogramHandler
);

const defaultRouter = Router();
defaultRouter.use(authenticate);
defaultRouter.get(
    "/patients/:patientId/odontogram",
    getPatientOdontogramHandler
);
defaultRouter.post(
    "/consultations/:consultationId/odontogram/initialize",
    initializeConsultationOdontogramHandler
);
defaultRouter.get(
    "/consultations/:consultationId/odontogram",
    getConsultationOdontogramHandler
);
defaultRouter.put(
    "/consultations/:consultationId/odontogram",
    updateConsultationOdontogramHandler
);

export default defaultRouter;
