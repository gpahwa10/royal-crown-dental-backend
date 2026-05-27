import { NextFunction, Response } from "express";
import { canRegisterStaff } from "../modules/auth/auth.constants";
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

/** HR, Director, or super admin. */
export const requireEmployeeListAccess = requireHROrPlatformAdmin(
    "list employees"
);
