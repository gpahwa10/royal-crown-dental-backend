import { NextFunction, Response } from "express";
import { HR_ROLES } from "../modules/auth/auth.constants";
import { AuthRequest } from "./auth.middleware";

export const requireHR = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (req.employee?.isSuperAdmin) {
      return next();
    }
  
    const roles = req.employee?.roles || [];
    const hasHRAccess = roles.some((role) =>
      (HR_ROLES as readonly string[]).includes(role)
    );
  
    if (!hasHRAccess) {
      return res.status(403).json({
        success: false,
        message: "HR access required"
      });
    }
  
    next();
  };