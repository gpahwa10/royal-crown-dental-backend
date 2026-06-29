import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import {
    getUploadHandler,
    presignUploadHandler,
    registerUploadHandler,
} from "./uploads.controller";

const router = Router();

router.use(authenticate);

router.post("/presign", presignUploadHandler);
router.post("/:id/register", registerUploadHandler);
router.get("/:id", getUploadHandler);

export default router;
