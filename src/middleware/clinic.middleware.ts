import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";

export const validateClinicAccess = (
  clinicIdField = "clinicId"
) => {
  return (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (req.employee?.isSuperAdmin) {
      return next();
    }

    const bodyClinicId =
      req.body[clinicIdField];

    if (
      bodyClinicId &&
      bodyClinicId !== req.employee?.clinicId
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You cannot access another clinic"
      });
    }

    next();
  };
};