import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { hasPlatformAdminAccess } from "../auth/auth.constants";
import {
    deleteClinic,
    getClinicById,
    getClinicHours,
    putClinicHours,
    updateClinic,
} from "./clinics.service";
import {
    assertClinicReadAccess,
    assertPlatformAdminAccess,
    handleError,
} from "./clinics.utils";
import {
    clinicIdParamSchema,
    replaceClinicWorkingHoursSchema,
    updateClinicSchema,
} from "./clinics.validation";

export const listClinicsHandler = async (req: AuthRequest, res: Response) => {
    try {
        const clinic = await getClinicById(req.clinicId!);

        return res.status(200).json({
            success: true,
            message: "Clinics listed successfully",
            data: [clinic],
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getClinicHandler = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = clinicIdParamSchema.parse(req.params);
        assertClinicReadAccess(req, id);
        const clinic = await getClinicById(id);

        if (!clinic.isActive && !hasPlatformAdminAccess(req.employee)) {
            throw new Error("Clinic not found");
        }

        return res.status(200).json({ success: true, data: clinic });
    } catch (error) {
        return handleError(res, error);
    }
};

export const createClinicHandler = async (req: AuthRequest, res: Response) => {
    try {
        assertPlatformAdminAccess(req);
        return res.status(403).json({
            success: false,
            message: "This deployment is limited to one clinic",
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const updateClinicHandler = async (req: AuthRequest, res: Response) => {
    try {
        assertPlatformAdminAccess(req);
        const { id } = clinicIdParamSchema.parse(req.params);
        assertClinicReadAccess(req, id);
        const body = updateClinicSchema.parse(req.body);
        const clinic = await updateClinic(id, body);

        return res.status(200).json({
            success: true,
            message: "Clinic updated successfully",
            data: clinic,
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const deleteClinicHandler = async (req: AuthRequest, res: Response) => {
    try {
        assertPlatformAdminAccess(req);
        const { id } = clinicIdParamSchema.parse(req.params);
        assertClinicReadAccess(req, id);
        const clinic = await deleteClinic(id);

        return res.status(200).json({
            success: true,
            message: "Clinic deactivated successfully",
            data: clinic,
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getClinicWorkingHoursHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const clinicId = req.clinicId;
        if (!clinicId) {
            return res.status(400).json({
                success: false,
                message: "clinicId is required",
            });
        }

        const workingHours = await getClinicHours(clinicId);
        return res.status(200).json({ success: true, data: workingHours });
    } catch (error) {
        return handleError(res, error);
    }
};

export const putClinicWorkingHoursHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        assertPlatformAdminAccess(req);
        const { id } = clinicIdParamSchema.parse(req.params);
        assertClinicReadAccess(req, id);
        await getClinicById(id);
        const body = replaceClinicWorkingHoursSchema.parse(req.body);
        const workingHours = await putClinicHours(id, body.days);

        return res.status(200).json({
            success: true,
            message: "Clinic working hours updated",
            data: workingHours,
        });
    } catch (error) {
        return handleError(res, error);
    }
};
