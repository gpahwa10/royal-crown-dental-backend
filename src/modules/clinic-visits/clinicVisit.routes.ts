import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import {
    attachMedicalRecordHandler,
    checkOutClinicVisitHandler,
    createAppointmentFromVisitHandler,
    createClinicVisitHandler,
    createMembershipFromVisitHandler,
    getClinicVisitDashboardHandler,
    getClinicVisitHandler,
    listClinicVisitsHandler,
    registerPatientFromVisitHandler,
    startConsultationFromVisitHandler,
    updateClinicVisitHandler,
} from "./clinicVisit.controller";

const router = Router();

router.use(authenticate);

router.get("/dashboard/metrics", getClinicVisitDashboardHandler);
router.post("/", createClinicVisitHandler);
router.get("/", listClinicVisitsHandler);
router.get("/:id", getClinicVisitHandler);
router.patch("/:id", updateClinicVisitHandler);
router.patch("/:id/check-out", checkOutClinicVisitHandler);
router.post("/:id/register-patient", registerPatientFromVisitHandler);
router.post("/:id/start-consultation", startConsultationFromVisitHandler);
router.post("/:id/create-appointment", createAppointmentFromVisitHandler);
router.post("/:id/create-membership", createMembershipFromVisitHandler);
router.post("/:id/attach-medical-record", attachMedicalRecordHandler);

export default router;
