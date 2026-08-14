import { NextFunction, Response } from "express";
import { appConfig } from "../config/app.config";
import { AuthRequest } from "./auth.middleware";

export const clinicContext = (
    req: AuthRequest,
    _res: Response,
    next: NextFunction
) => {
    req.clinicId = appConfig.clinicId;
    next();
};

export const requireClinicId = (req: AuthRequest): string => {
    if (!req.clinicId) {
        throw new Error("Clinic context is not configured");
    }

    return req.clinicId;
};
