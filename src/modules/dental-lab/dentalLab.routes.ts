import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import {
    attachDentalLabFileHandler,
    createCementationAppointmentHandler,
    createDentalLabOrderHandler,
    deliverDentalLabOrderHandler,
    getDentalLabOrderHandler,
    listDentalLabOrdersHandler,
    recordCementationHandler,
    removeDentalLabFileHandler,
    updateDentalLabOrderHandler,
} from "./dentalLab.controller";

const router = Router();

router.use(authenticate);

router.post("/", createDentalLabOrderHandler);
router.get("/", listDentalLabOrdersHandler);
router.get("/:id", getDentalLabOrderHandler);
router.patch("/:id", updateDentalLabOrderHandler);
router.patch("/:id/deliver", deliverDentalLabOrderHandler);
router.post("/:id/cementation-appointment", createCementationAppointmentHandler);
router.patch("/:id/cementation", recordCementationHandler);
router.post("/:id/files", attachDentalLabFileHandler);
router.delete("/:id/files/:fileId", removeDentalLabFileHandler);

export default router;
