import { AuthRequest } from "middleware/auth.middleware";
import { Response } from "express";
import { listClinics } from "./clinics.service";
import { handleError } from "../auth/auth.utils";

export const listClinicsHandler = async (req: AuthRequest, res: Response) => {
    try {
        const result = await listClinics();
        return res.status(200).json({ success: true, message: "Clinics listed successfully", data: result });
    } catch (error) {
        return handleError(res, error);
    }
}