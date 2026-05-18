import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { requireHR } from "../../middleware/hr.middleware";
import { requireSuperAdmin } from "../../middleware/superAdmin.middleware";
import {
    createSuperAdminHandler,
    loginHandler,
    logoutHandler,
    registerHRHandler,
    registerStaffHandler,
} from "./auth.controller";
import { ensureSuperAdminCreateAccess } from "../../middleware/auth.middleware";

const router = Router();

router.post("/login", loginHandler);
router.post(
    "/staff/register",
    authenticate,
    requireHR,
    registerStaffHandler
);

router.post(
    "/hr/register",
    authenticate,
    requireSuperAdmin,
    registerHRHandler
);

router.post(
    "/super-admin",
    ensureSuperAdminCreateAccess,
    createSuperAdminHandler
);

router.post("/logout", authenticate, logoutHandler);

export default router;
