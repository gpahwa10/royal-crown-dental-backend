import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { hasPlatformAdminAccess } from "../auth/auth.constants";
import { getPatientDetails } from "../patients/patients.service";
import { assertPatientClinicAccess } from "../patients/patients.utils";
import {
    getFileWithDownloadUrl,
    listPatientUploads,
    presignUpload,
    registerUpload,
} from "./uploads.service";
import { assertFileClinicAccess, handleError } from "./uploads.utils";
import {
    fileIdParamSchema,
    patientIdParamSchema,
    patientUploadListQuerySchema,
    presignUploadSchema,
    registerUploadSchema,
} from "./uploads.validation";

export const presignUploadHandler = async (req: AuthRequest, res: Response) => {
    try {
        const body = presignUploadSchema.parse(req.body);
        const patientDetails = await getPatientDetails(body.patientId);

        assertPatientClinicAccess(
            patientDetails.patient.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.clinicId
        );

        const result = await presignUpload({
            ...body,
            uploadedBy: req.employee?.id,
        });

        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const registerUploadHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = fileIdParamSchema.parse(req.params);
        const body = registerUploadSchema.parse(req.body);

        const existing = await getFileWithDownloadUrl(id, false);

        assertFileClinicAccess(
            existing.file.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.clinicId
        );

        const file = await registerUpload(id, body);
        const withDownload = await getFileWithDownloadUrl(file.id, true);

        return res.status(200).json({ success: true, data: withDownload });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getUploadHandler = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = fileIdParamSchema.parse(req.params);
        const result = await getFileWithDownloadUrl(id, true);

        assertFileClinicAccess(
            result.file.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.clinicId
        );

        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listPatientUploadsHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { patientId } = patientIdParamSchema.parse(req.params);
        const query = patientUploadListQuerySchema.parse(req.query);
        const patientDetails = await getPatientDetails(patientId);

        assertPatientClinicAccess(
            patientDetails.patient.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.clinicId
        );

        const result = await listPatientUploads(patientId, {
            page: query.page,
            limit: query.limit,
            documentType: query.documentType,
            status: query.status,
        });

        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};
