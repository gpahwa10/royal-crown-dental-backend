import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { listPatientClinicVisitsHandler } from "../clinic-visits/clinicVisit.controller";
import { listPatientInvoicesHandler } from "../billing/billing.controller";
import { listPatientDentalLabOrdersHandler } from "../dental-lab/dentalLab.controller";
import { listPatientConsultationsHandler } from "../consultations/consultations.controller";
import { listPatientLabRequestsHandler } from "../lab-requests/labRequests.controller";
import { listPatientUploadsHandler } from "../uploads/uploads.controller";
import { listPatientRadiographsHandler } from "../radiographs/radiographs.controller";
import { listPatientPrescriptionsHandler } from "../prescriptions/prescriptions.controller";
import {
    blacklistPatientHandler,
    getPatientDetailsHandler,
    listPatientsByClinicHandler,
    listPatientsHandler,
    registerPatientHandler,
    updatePatientHandler,
} from "./patients.controller";

const router = Router();

router.use(authenticate);

router.post("/", registerPatientHandler);
router.get("/", listPatientsHandler);
router.get("/clinic/:clinicId", listPatientsByClinicHandler);
router.get("/:patientId/consultations", listPatientConsultationsHandler);
router.get("/:patientId/prescriptions", listPatientPrescriptionsHandler);
router.get("/:patientId/lab-requests", listPatientLabRequestsHandler);
router.get("/:patientId/uploads", listPatientUploadsHandler);
router.get("/:patientId/dental-lab-orders", listPatientDentalLabOrdersHandler);
router.get("/:patientId/radiographs", listPatientRadiographsHandler);
router.get("/:patientId/clinic-visits", listPatientClinicVisitsHandler);
router.get("/:patientId/invoices", listPatientInvoicesHandler);
router.get("/:id", getPatientDetailsHandler);
router.put("/:id", updatePatientHandler);
router.patch("/:id/blacklist", blacklistPatientHandler);

export default router;
