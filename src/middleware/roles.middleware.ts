import { Response, NextFunction } from "express";
import { hasPlatformAdminAccess } from "../modules/auth/auth.constants";
import { AuthRequest } from "./auth.middleware";

export const requireRoles = (
  allowedRoles: string[]
) => {
  return (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (hasPlatformAdminAccess(req.employee)) {
      return next();
    }

    const employeeRoles = req.employee?.roles || [];

    const hasAccess = employeeRoles.some(
      (role) => allowedRoles.includes(role)
    );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    next();
  };
};