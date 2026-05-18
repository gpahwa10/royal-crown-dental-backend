import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";

export const requireSuperAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.employee?.isSuperAdmin) {
    return res.status(403).json({
      success: false,
      message: "Super admin access required"
    });
  }

  next();
};