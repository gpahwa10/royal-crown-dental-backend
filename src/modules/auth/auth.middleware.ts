import { NextFunction, Response } from "express";
import { AuthRequest, authenticate } from "../../middleware/auth.middleware";
import { requireSuperAdmin } from "../../middleware/superAdmin.middleware";
import { hasSuperAdmins } from "./auth.service";

export const ensureSuperAdminCreateAccess = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    const superAdminsExist = await hasSuperAdmins();

    if (!superAdminsExist) {
        return next();
    }

    return authenticate(req, res, () =>
        requireSuperAdmin(req, res, next)
    );
};
