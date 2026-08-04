import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { hasPlatformAdminAccess } from "../auth/auth.constants";
import {
    createClinic,
    deleteClinic,
    getClinicById,
    getClinicHours,
    listClinics,
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
    createClinicSchema,
    listClinicsQuerySchema,
    replaceClinicWorkingHoursSchema,
    updateClinicSchema,
} from "./clinics.validation";

export const listClinicsHandler = async (req: AuthRequest, res: Response) => {
    try {
        const query = listClinicsQuerySchema.parse(req.query);

        if (query.includeInactive) {
            assertPlatformAdminAccess(req);
        }

        const result = await listClinics({
            includeInactive: query.includeInactive,
            search: query.search,
        });

        return res.status(200).json({
            success: true,
            message: "Clinics listed successfully",
            data: result,
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getClinicHandler = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = clinicIdParamSchema.parse(req.params);
        const clinic = await getClinicById(id);

        assertClinicReadAccess(req, clinic.id);

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
        const body = createClinicSchema.parse(req.body);
        const clinic = await createClinic(body);

        return res.status(201).json({
            success: true,
            message: "Clinic created successfully",
            data: clinic,
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const updateClinicHandler = async (req: AuthRequest, res: Response) => {
    try {
        assertPlatformAdminAccess(req);
        const { id } = clinicIdParamSchema.parse(req.params);
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
        const { id } = clinicIdParamSchema.parse(req.params);
        const clinic = await getClinicById(id);
        assertClinicReadAccess(req, clinic.id);

        const workingHours = await getClinicHours(id);
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
