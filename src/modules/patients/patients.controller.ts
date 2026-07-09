import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { hasPlatformAdminAccess } from "../auth/auth.constants";
import {
    assertPatientClinicAccess,
    blacklistPatient,
    getPatientDetails,
    listPatients,
    registerPatient,
    updatePatient,
    updatePatientBasicDetails,
    updatePatientMedicalProfile,
} from "./patients.service";
import { handleError } from "./patients.utils";
import {
    blacklistPatientSchema,
    clinicIdParamSchema,
    createPatientSchema,
    patientIdParamSchema,
    patientIdRouteParamSchema,
    patientListQuerySchema,
    updatePatientBasicDetailsSchema,
    updatePatientMedicalProfileSchema,
    updatePatientSchema,
} from "./patients.validation";

const resolveClinicId = (
    req: AuthRequest,
    requestedClinicId?: string
): string | undefined => {
    if (hasPlatformAdminAccess(req.employee)) {
        return requestedClinicId ?? req.employee?.clinicId ?? undefined;
    }

    return req.employee?.clinicId;
};

export const registerPatientHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const body = createPatientSchema.parse(req.body);

        const clinicId = hasPlatformAdminAccess(req.employee)
            ? body.clinicId
            : req.employee?.clinicId ?? body.clinicId;

        if (!clinicId) {
            return res.status(400).json({
                success: false,
                message: "clinicId is required",
            });
        }

        const result = await registerPatient({
            ...body,
            clinicId,
        });

        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listPatientsHandler = async (req: AuthRequest, res: Response) => {
    try {
        const query = patientListQuerySchema.parse(req.query);
        const clinicId = resolveClinicId(req, query.clinicId);

        const result = await listPatients({
            page: query.page,
            limit: query.limit,
            search: query.search,
            clinicId,
            isBlackListed: query.isBlackListed,
        });

        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listPatientsByClinicHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { clinicId } = clinicIdParamSchema.parse(req.params);
        const query = patientListQuerySchema.parse(req.query);

        if (
            !hasPlatformAdminAccess(req.employee) &&
            req.employee?.clinicId !== clinicId
        ) {
            return res.status(403).json({
                success: false,
                message: "You cannot access patients from another clinic",
            });
        }

        const result = await listPatients({
            page: query.page,
            limit: query.limit,
            search: query.search,
            clinicId,
            isBlackListed: query.isBlackListed,
        });

        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getPatientDetailsHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = patientIdParamSchema.parse(req.params);
        const details = await getPatientDetails(id);

        assertPatientClinicAccess(
            details.patient.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.employee?.clinicId
        );

        return res.status(200).json({ success: true, data: details });
    } catch (error) {
        return handleError(res, error);
    }
};

export const updatePatientHandler = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = patientIdParamSchema.parse(req.params);
        const body = updatePatientSchema.parse(req.body);

        const existing = await getPatientDetails(id);
        assertPatientClinicAccess(
            existing.patient.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.employee?.clinicId
        );

        const result = await updatePatient(id, body);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const updatePatientBasicDetailsHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { patientId } = patientIdRouteParamSchema.parse(req.params);
        const body = updatePatientBasicDetailsSchema.parse(req.body);

        const existing = await getPatientDetails(patientId);
        assertPatientClinicAccess(
            existing.patient.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.employee?.clinicId
        );

        const result = await updatePatientBasicDetails(patientId, body);
        return res.status(200).json({
            success: true,
            message: "Patient basic details updated successfully",
            data: result,
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const updatePatientMedicalProfileHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { patientId } = patientIdRouteParamSchema.parse(req.params);
        const body = updatePatientMedicalProfileSchema.parse(req.body);

        const existing = await getPatientDetails(patientId);
        assertPatientClinicAccess(
            existing.patient.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.employee?.clinicId
        );

        const result = await updatePatientMedicalProfile(patientId, body);
        return res.status(200).json({
            success: true,
            message: "Patient medical profile updated successfully",
            data: result,
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const blacklistPatientHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = patientIdParamSchema.parse(req.params);
        const body = blacklistPatientSchema.parse(req.body);

        const existing = await getPatientDetails(id);
        assertPatientClinicAccess(
            existing.patient.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.employee?.clinicId
        );

        const patient = await blacklistPatient(
            id,
            body.isBlackListed,
            body.reason
        );

        return res.status(200).json({ success: true, data: patient });
    } catch (error) {
        return handleError(res, error);
    }
};
