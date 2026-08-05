import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { hasPlatformAdminAccess } from "../auth/auth.constants";
import {
    getAuthenticatedDownloadUrl,
    getClinicIdForPrescription,
    getPrescriptionFileMeta,
    resolveShareRedirect,
    uploadPrescriptionPdf,
} from "./prescriptionSharing.service";
import {
    assertPrescriptionClinicAccess,
    handleError,
} from "./prescriptionSharing.utils";
import {
    prescriptionIdParamSchema,
    shareTokenParamSchema,
    uploadPrescriptionFieldsSchema,
} from "./prescriptionSharing.validation";

export const uploadPrescriptionHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const fields = uploadPrescriptionFieldsSchema.parse(req.body);
        const file = req.file;

        if (!file) {
            return res.status(400).json({
                success: false,
                message: "PDF file is required",
            });
        }

        assertPrescriptionClinicAccess(
            fields.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.employee?.clinicId
        );

        const result = await uploadPrescriptionPdf({
            file,
            clinicId: fields.clinicId,
            patientId: fields.patientId,
            prescriptionId: fields.prescriptionId,
            uploadedBy: req.employee?.isSuperAdmin
                ? null
                : (req.employee?.id ?? null),
        });

        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getPrescriptionFileHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = prescriptionIdParamSchema.parse(req.params);
        const meta = await getPrescriptionFileMeta(id);

        assertPrescriptionClinicAccess(
            meta.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.employee?.clinicId
        );

        return res.status(200).json({ success: true, data: meta });
    } catch (error) {
        return handleError(res, error);
    }
};

export const downloadPrescriptionFileHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = prescriptionIdParamSchema.parse(req.params);
        const clinicId = await getClinicIdForPrescription(id);

        assertPrescriptionClinicAccess(
            clinicId,
            hasPlatformAdminAccess(req.employee),
            req.employee?.clinicId
        );

        const result = await getAuthenticatedDownloadUrl(id);

        return res.status(200).json({
            success: true,
            data: {
                downloadUrl: result.downloadUrl,
                expiresIn: result.expiresIn,
                originalFileName: result.originalFileName,
            },
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const shareRedirectHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { token } = shareTokenParamSchema.parse(req.params);
        const downloadUrl = await resolveShareRedirect(token);
        return res.redirect(302, downloadUrl);
    } catch (error) {
        return handleError(res, error);
    }
};
