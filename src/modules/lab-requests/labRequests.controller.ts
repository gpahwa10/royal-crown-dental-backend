import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { hasPlatformAdminAccess } from "../auth/auth.constants";
import { getPatientDetails } from "../patients/patients.service";
import { assertPatientClinicAccess } from "../patients/patients.utils";
import {
    createLabRequest,
    deliverLabRequest,
    getLabRequestById,
    listLabRequests,
    listLabRequestsByPatientId,
    moveLabRequestToExamination,
    uploadLabReport,
} from "./labRequests.service";
import {
    assertLabRequestClinicAccess,
    handleError,
} from "./labRequests.utils";
import {
    createLabRequestSchema,
    deliverLabRequestSchema,
    labRequestIdParamSchema,
    labRequestListQuerySchema,
    moveToExaminationSchema,
    patientIdParamSchema,
    uploadLabReportSchema,
} from "./labRequests.validation";

const resolveClinicId = (
    req: AuthRequest,
    requestedClinicId?: string
): string | undefined => {
    if (hasPlatformAdminAccess(req.employee)) {
        return requestedClinicId ?? req.employee?.clinicId ?? undefined;
    }

    return req.employee?.clinicId;
};

export const createLabRequestHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const body = createLabRequestSchema.parse(req.body);

        const clinicId = hasPlatformAdminAccess(req.employee)
            ? body.clinicId
            : req.employee?.clinicId ?? body.clinicId;

        if (!clinicId) {
            return res.status(400).json({
                success: false,
                message: "clinicId is required",
            });
        }

        const result = await createLabRequest({
            ...body,
            clinicId,
            consultationId: body.consultationId ?? null,
        });

        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listLabRequestsHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const query = labRequestListQuerySchema.parse(req.query);
        const clinicId = resolveClinicId(req, query.clinicId);

        const result = await listLabRequests({
            page: query.page,
            limit: query.limit,
            search: query.search,
            clinicId,
            doctorId: query.doctorId,
            status: query.status,
        });

        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getLabRequestHandler = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = labRequestIdParamSchema.parse(req.params);
        const details = await getLabRequestById(id);

        assertLabRequestClinicAccess(
            details.request.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.employee?.clinicId
        );

        return res.status(200).json({ success: true, data: details });
    } catch (error) {
        return handleError(res, error);
    }
};

export const moveLabRequestToExaminationHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = labRequestIdParamSchema.parse(req.params);
        moveToExaminationSchema.parse(req.body);

        const existing = await getLabRequestById(id);
        assertLabRequestClinicAccess(
            existing.request.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.employee?.clinicId
        );

        const result = await moveLabRequestToExamination(id);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const deliverLabRequestHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = labRequestIdParamSchema.parse(req.params);
        deliverLabRequestSchema.parse(req.body);

        const existing = await getLabRequestById(id);
        assertLabRequestClinicAccess(
            existing.request.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.employee?.clinicId
        );

        const result = await deliverLabRequest(id);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const uploadLabReportHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = labRequestIdParamSchema.parse(req.params);
        const body = uploadLabReportSchema.parse(req.body);

        const existing = await getLabRequestById(id);
        assertLabRequestClinicAccess(
            existing.request.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.employee?.clinicId
        );

        const report = await uploadLabReport(id, body);
        return res.status(201).json({ success: true, data: report });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listPatientLabRequestsHandler = async (
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

        const labRequestRows = await listLabRequestsByPatientId(patientId);
        return res.status(200).json({ success: true, data: labRequestRows });
    } catch (error) {
        return handleError(res, error);
    }
};
