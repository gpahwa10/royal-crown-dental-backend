import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { ensureSuperAdminCreateAccess } from "../../middleware/auth.middleware";
import {
    createSuperAdminHandler,
    loginHandler,
    logoutHandler,
} from "./auth.controller";

const router = Router();

router.post("/login", loginHandler);

router.post(
    "/super-admin",
    ensureSuperAdminCreateAccess,
    createSuperAdminHandler
);

router.post("/logout", authenticate, logoutHandler);

export default router;
