import { NextFunction, Response } from "express";
import { canRegisterHR } from "../modules/auth/auth.constants";
import { AuthRequest } from "./auth.middleware";

/** Director or super admin only (not clinic HR). */
export const requireHRRegistration = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    if (!canRegisterHR(req.employee)) {
        return res.status(403).json({
            success: false,
            message:
                "Director or Super admin access required to register HR",
        });
    }

    next();
};
