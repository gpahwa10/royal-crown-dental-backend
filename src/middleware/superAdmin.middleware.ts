import { Response, NextFunction } from "express";
import { hasPlatformAdminAccess } from "../modules/auth/auth.constants";
import { AuthRequest } from "./auth.middleware";

export const requireSuperAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!hasPlatformAdminAccess(req.employee)) {
    return res.status(403).json({
      success: false,
      message: "Super admin or Director access required"
    });
  }

  next();
};