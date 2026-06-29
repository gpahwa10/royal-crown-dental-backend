import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import {
    getPrescriptionHandler,
    updatePrescriptionHandler,
} from "./prescriptions.controller";

const router = Router();

router.use(authenticate);

router.get("/:id", getPrescriptionHandler);
router.put("/:id", updatePrescriptionHandler);

export default router;
