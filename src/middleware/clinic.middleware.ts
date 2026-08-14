import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";

export const validateClinicAccess = (
  _clinicIdField = "clinicId"
) => {
  return (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    const bodyClinicId = req.body?.clinicId;

    if (bodyClinicId && bodyClinicId !== req.clinicId) {
      return res.status(403).json({
        success: false,
        message: "You cannot access another clinic"
      });
    }

    next();
  };
};
