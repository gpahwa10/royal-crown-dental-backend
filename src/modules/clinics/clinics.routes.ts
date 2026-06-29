import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import {
    createClinicHandler,
    deleteClinicHandler,
    getClinicHandler,
    listClinicsHandler,
    updateClinicHandler,
} from "./clinics.controller";

const router = Router();

router.use(authenticate);

router.get("/list", listClinicsHandler);
router.get("/", listClinicsHandler);
router.get("/:id", getClinicHandler);
router.post("/", createClinicHandler);
router.patch("/:id", updateClinicHandler);
router.delete("/:id", deleteClinicHandler);

export default router;
