import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { deleteRadiographHandler } from "./radiographs.controller";

const router = Router();

router.use(authenticate);

router.delete("/:id", deleteRadiographHandler);

export default router;
