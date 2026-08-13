import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { ensureSuperAdminCreateAccess } from "../../middleware/auth.middleware";
import {
    changePasswordHandler,
    createSuperAdminHandler,
    forgotPasswordHandler,
    loginHandler,
    logoutHandler,
} from "./auth.controller";

const router = Router();

router.post("/login", loginHandler);
router.post("/forgot-password", forgotPasswordHandler);

router.post(
    "/super-admin",
    ensureSuperAdminCreateAccess,
    createSuperAdminHandler
);

router.post("/logout", authenticate, logoutHandler);
router.post("/change-password", authenticate, changePasswordHandler);

export default router;
