import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import {
    canAccessConsultationPatientList,
    hasPlatformAdminAccess,
} from "../auth/auth.constants";
import { getPatientDetails, listPatients } from "../patients/patients.service";
import { patientListQuerySchema } from "../patients/patients.validation";
import { assertPatientClinicAccess } from "../patients/patients.utils";
import { createPrescriptionForConsultation } from "../prescriptions/prescriptions.service";
import { createPrescriptionSchema } from "../prescriptions/prescriptions.validation";
import {
    assertConsultationClinicAccess,
    completeConsultation,
    createConsultation,
    getConsultationById,
    listConsultationsByPatientId,
    startConsultation,
    updateConsultation,
} from "./consultations.service";
import { handleError } from "./consultations.utils";
import {
    completeConsultationSchema,
    consultationIdParamSchema,
    createConsultationSchema,
    patientIdParamSchema,
    startConsultationSchema,
    updateConsultationSchema,
} from "./consultations.validation";

export const listConsultationPatientsHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        if (!canAccessConsultationPatientList(req.employee)) {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to list patients for consultations",
            });
        }

        const query = patientListQuerySchema.parse(req.query);

        const clinicId = hasPlatformAdminAccess(req.employee)
            ? query.clinicId ?? req.employee?.clinicId ?? undefined
            : req.employee?.clinicId;

        if (!clinicId) {
            return res.status(400).json({
                success: false,
                message: "clinicId is required",
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

export const createConsultationHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const body = createConsultationSchema.parse(req.body);

        const clinicId = hasPlatformAdminAccess(req.employee)
            ? body.clinicId
            : req.employee?.clinicId ?? body.clinicId;

        if (!clinicId) {
            return res.status(400).json({
                success: false,
                message: "clinicId is required",
            });
        }

        const consultation = await createConsultation({
            ...body,
            clinicId,
        });

        return res.status(201).json({ success: true, data: consultation });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getConsultationHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = consultationIdParamSchema.parse(req.params);
        const result = await getConsultationById(id);

        assertConsultationClinicAccess(
            result.consultation.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.employee?.clinicId
        );

        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const updateConsultationHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = consultationIdParamSchema.parse(req.params);
        const body = updateConsultationSchema.parse(req.body);

        const existing = await getConsultationById(id);
        assertConsultationClinicAccess(
            existing.consultation.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.employee?.clinicId
        );

        const consultation = await updateConsultation(id, body);
        return res.status(200).json({ success: true, data: consultation });
    } catch (error) {
        return handleError(res, error);
    }
};

export const startConsultationHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = consultationIdParamSchema.parse(req.params);
        startConsultationSchema.parse(req.body ?? {});

        const existing = await getConsultationById(id);
        assertConsultationClinicAccess(
            existing.consultation.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.employee?.clinicId
        );

        const consultation = await startConsultation(id);
        return res.status(200).json({ success: true, data: consultation });
    } catch (error) {
        return handleError(res, error);
    }
};

export const completeConsultationHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = consultationIdParamSchema.parse(req.params);
        completeConsultationSchema.parse(req.body ?? {});

        const existing = await getConsultationById(id);
        assertConsultationClinicAccess(
            existing.consultation.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.employee?.clinicId
        );

        const consultation = await completeConsultation(id);
        return res.status(200).json({ success: true, data: consultation });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listPatientConsultationsHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { patientId } = patientIdParamSchema.parse(req.params);
        const patientDetails = await getPatientDetails(patientId);

        assertPatientClinicAccess(
            patientDetails.patient.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.employee?.clinicId
        );

        const items = await listConsultationsByPatientId(patientId);
        return res.status(200).json({ success: true, data: items });
    } catch (error) {
        return handleError(res, error);
    }
};

export const createConsultationPrescriptionHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = consultationIdParamSchema.parse(req.params);
        const body = createPrescriptionSchema.parse(req.body);

        const existing = await getConsultationById(id);
        assertConsultationClinicAccess(
            existing.consultation.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.employee?.clinicId
        );

        const prescription = await createPrescriptionForConsultation(id, body);
        return res.status(201).json({ success: true, data: prescription });
    } catch (error) {
        return handleError(res, error);
    }
};
