import { Response } from "express";
import { ZodError } from "zod";
import { AuthRequest } from "../../middleware/auth.middleware";
import {
    hasPlatformAdminAccess,
    isDoctorEmployee,
    ROLE_CLINIC_HEAD,
    ROLE_DOCTOR,
    normalizeRoleName,
} from "../auth/auth.constants";
import {
    getConsultationOdontogram,
    getPatientCurrentOdontogram,
    initializeConsultationOdontogram,
    OdontogramError,
    updateConsultationOdontogram,
} from "./odontograms.service";
import {
    consultationIdParamSchema,
    patientIdParamSchema,
    updateConsultationOdontogramSchema,
} from "./odontograms.validation";

export const handleOdontogramError = (res: Response, error: unknown) => {
    if (error instanceof OdontogramError) {
        return res.status(error.status).json({
            success: false,
            error: {
                code: error.code,
                message: error.message,
            },
            message: error.message,
        });
    }

    if (error instanceof ZodError) {
        const issues = error.issues
            .map((issue) => {
                const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
                return `${path}${issue.message}`;
            })
            .join("; ");

        return res.status(400).json({
            success: false,
            error: {
                code: "ODONTOGRAM_INVALID_STATE",
                message: issues,
            },
            message: issues,
        });
    }

    const message =
        error instanceof Error ? error.message : "Internal server error";

    return res.status(500).json({
        success: false,
        error: {
            code: "ODONTOGRAM_INVALID_STATE",
            message,
        },
        message,
    });
};

const canModifyOdontogram = (req: AuthRequest) => {
    if (hasPlatformAdminAccess(req.employee)) {
        return true;
    }
    if (isDoctorEmployee(req.employee)) {
        return true;
    }
    const roles = (req.employee?.roles ?? []).map(normalizeRoleName);
    return roles.includes(ROLE_CLINIC_HEAD) || roles.includes(ROLE_DOCTOR);
};

export const getPatientOdontogramHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { patientId } = patientIdParamSchema.parse(req.params);
        const clinicId = req.clinicId;

        if (!clinicId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "ODONTOGRAM_UNAUTHORIZED",
                    message: "clinicId is required in authenticated context",
                },
                message: "clinicId is required in authenticated context",
            });
        }

        const odontogram = await getPatientCurrentOdontogram(
            patientId,
            clinicId
        );

        return res.status(200).json({
            success: true,
            odontogram,
        });
    } catch (error) {
        return handleOdontogramError(res, error);
    }
};

export const initializeConsultationOdontogramHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { consultationId } = consultationIdParamSchema.parse(req.params);
        const clinicId = req.clinicId;

        if (!clinicId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "ODONTOGRAM_UNAUTHORIZED",
                    message: "clinicId is required in authenticated context",
                },
                message: "clinicId is required in authenticated context",
            });
        }

        if (!canModifyOdontogram(req)) {
            return res.status(403).json({
                success: false,
                error: {
                    code: "ODONTOGRAM_UNAUTHORIZED",
                    message: "You are not authorized to initialize consultation odontograms",
                },
                message: "You are not authorized to initialize consultation odontograms",
            });
        }

        const odontogram = await initializeConsultationOdontogram(
            consultationId,
            clinicId
        );

        return res.status(200).json({
            success: true,
            odontogram,
        });
    } catch (error) {
        return handleOdontogramError(res, error);
    }
};

export const getConsultationOdontogramHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { consultationId } = consultationIdParamSchema.parse(req.params);
        const clinicId = req.clinicId;

        if (!clinicId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "ODONTOGRAM_UNAUTHORIZED",
                    message: "clinicId is required in authenticated context",
                },
                message: "clinicId is required in authenticated context",
            });
        }

        const odontogram = await getConsultationOdontogram(
            consultationId,
            clinicId
        );

        return res.status(200).json({
            success: true,
            odontogram,
        });
    } catch (error) {
        return handleOdontogramError(res, error);
    }
};

export const updateConsultationOdontogramHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { consultationId } = consultationIdParamSchema.parse(req.params);
        const body = updateConsultationOdontogramSchema.parse(req.body);
        const clinicId = req.clinicId;
        const userId = req.employee?.id;

        if (!clinicId || !userId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "ODONTOGRAM_UNAUTHORIZED",
                    message: "Authentication context is required",
                },
                message: "Authentication context is required",
            });
        }

        if (!canModifyOdontogram(req)) {
            return res.status(403).json({
                success: false,
                error: {
                    code: "ODONTOGRAM_UNAUTHORIZED",
                    message: "You are not authorized to update consultation odontograms",
                },
                message: "You are not authorized to update consultation odontograms",
            });
        }

        const odontogram = await updateConsultationOdontogram(
            consultationId,
            body,
            clinicId,
            userId
        );

        return res.status(200).json({
            success: true,
            odontogram,
        });
    } catch (error) {
        return handleOdontogramError(res, error);
    }
};
