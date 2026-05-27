import { NextFunction, Response } from "express";
import { canRegisterStaff } from "../modules/auth/auth.constants";
import { AuthRequest } from "./auth.middleware";

/** @deprecated Use requireStaffRegistration — same rules (HR, Director, super admin). */
export const requireHR = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    if (!canRegisterStaff(req.employee)) {
        return res.status(403).json({
            success: false,
            message: "HR access required",
        });
    }

    next();
};