import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";

export const requireRoles = (
  allowedRoles: string[]
) => {
  return (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (req.employee?.isSuperAdmin) {
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