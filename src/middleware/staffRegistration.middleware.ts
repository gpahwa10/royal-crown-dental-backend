import { NextFunction, Response } from "express";
import {
    canListEmployees,
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

/** HR, Director, super admin, Lab Technician, or Phlebotomist. */
export const requireEmployeeListAccess = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    if (!canListEmployees(req.employee)) {
        return res.status(403).json({
            success: false,
            message:
                "HR, Director, Super admin, Lab Technician, or Phlebotomist access required to list employees",
        });
    }

    next();
};

/** HR, Director, or super admin. */
export const requireEmployeeManagementAccess = requireHROrPlatformAdmin(
    "manage employees"
);
