import { NextFunction, Response } from "express";
import {
    canAccessEmployeeList,
    canRegisterStaff,
} from "../modules/auth/auth.constants";
import { AuthRequest } from "./auth.middleware";

const requireHROrPlatformAdmin =
    (action: string) =>
    (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!canRegisterStaff(req.employee)) {
            return res.status(403).json({
                success: false,
                message: `HR, Director, or Super admin access required to ${action}`,
            });
        }

        next();
    };

/** HR, Director, or super admin. */
export const requireStaffRegistration = requireHROrPlatformAdmin(
    "register staff"
);

/** Full employee list or clinic-scoped doctor picker. */
export const requireEmployeeListAccess = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    if (!canAccessEmployeeList(req.employee)) {
        return res.status(403).json({
            success: false,
            message:
                "You do not have permission to list employees for this clinic",
        });
    }

    next();
};

/** HR, Director, or super admin. */
export const requireEmployeeManagementAccess = requireHROrPlatformAdmin(
    "manage employees"
);
