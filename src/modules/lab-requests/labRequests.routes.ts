import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import {
    createLabRequestHandler,
    deliverLabRequestHandler,
    getLabRequestHandler,
    listLabRequestsHandler,
    moveLabRequestToExaminationHandler,
    uploadLabReportHandler,
} from "./labRequests.controller";

const router = Router();

router.use(authenticate);

router.post("/", createLabRequestHandler);
router.get("/", listLabRequestsHandler);
router.get("/:id", getLabRequestHandler);
router.patch("/:id/examination", moveLabRequestToExaminationHandler);
router.patch("/:id/deliver", deliverLabRequestHandler);
router.post("/:id/report", uploadLabReportHandler);

export default router;
