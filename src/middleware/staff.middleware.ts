import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";

export const requireStaff = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.employee) {
    return res.status(403).json({
      success: false,
      message: "Unauthorized"
    });
  }

  next();
};