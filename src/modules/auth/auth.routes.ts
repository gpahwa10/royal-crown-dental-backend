import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { requireHR } from "../../middleware/hr.middleware";
import { requireSuperAdmin } from "../../middleware/superAdmin.middleware";
import {
    createSuperAdminHandler,
    logoutHandler,
    registerHRHandler,
    registerStaffHandler,
    staffLoginHandler,
    superAdminLoginHandler,
} from "./auth.controller";
import { ensureSuperAdminCreateAccess } from "./auth.middleware";

const router = Router();

router.post("/staff/login", staffLoginHandler);
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

router.post("/super-admin/login", superAdminLoginHandler);
router.post(
    "/super-admin",
    ensureSuperAdminCreateAccess,
    createSuperAdminHandler
);

router.post("/logout", authenticate, logoutHandler);

export default router;
