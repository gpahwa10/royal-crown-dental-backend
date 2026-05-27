import { Router } from "express";
import { listClinicsHandler } from "./clinics.controller";

const router = Router();

router.get("/list", listClinicsHandler);

export default router;