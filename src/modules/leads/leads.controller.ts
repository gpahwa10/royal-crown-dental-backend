import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { hasPlatformAdminAccess } from "../auth/auth.constants";
import {
    assertLeadClinicAccess,
    bookLeadAppointment,
    convertLeadToPatient,
    createLead,
    createPublicLead,
    getLeadById,
    listLeads,
    updateLead,
    updateLeadStatus,
} from "./leads.service";
import { handleError } from "./leads.utils";
import {
    bookLeadAppointmentSchema,
    convertLeadToPatientSchema,
    createLeadSchema,
    createPublicLeadSchema,
    leadParamsSchema,
    listLeadsQuerySchema,
    updateLeadSchema,
    updateLeadStatusSchema,
} from "./leads.validations";

const resolveClinicId = (
    req: AuthRequest,
    requestedClinicId?: string
): string | undefined => {
    if (hasPlatformAdminAccess(req.employee)) {
        return requestedClinicId ?? req.employee?.clinicId ?? undefined;
    }

    return req.employee?.clinicId;
};

export const createLeadHandler = async (req: AuthRequest, res: Response) => {
    try {
        const body = createLeadSchema.parse(req.body);

        const clinicId = hasPlatformAdminAccess(req.employee)
            ? body.clinicId
            : req.employee?.clinicId ?? body.clinicId;

        if (!clinicId) {
            return res.status(400).json({
                success: false,
                message: "clinicId is required",
            });
        }

        const lead = await createLead({
            ...body,
            clinicId,
        });

        return res.status(201).json({ success: true, data: lead });
    } catch (error) {
        return handleError(res, error);
    }
};

export const createPublicLeadHandler = async (req: AuthRequest, res: Response) => {
    try {
        const body = createPublicLeadSchema.parse(req.body);
        const lead = await createPublicLead(body);
        return res.status(201).json({ success: true, data: lead });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listLeadsHandler = async (req: AuthRequest, res: Response) => {
    try {
        const query = listLeadsQuerySchema.parse(req.query);
        const clinicId = resolveClinicId(req, query.clinicId);

        const result = await listLeads({
            page: query.page,
            limit: query.limit,
            clinicId,
            status: query.status,
            search: query.search,
        });

        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getLeadByIdHandler = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = leadParamsSchema.parse(req.params);
        const lead = await getLeadById(id);

        assertLeadClinicAccess(
            lead.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.employee?.clinicId
        );

        return res.status(200).json({ success: true, data: lead });
    } catch (error) {
        return handleError(res, error);
    }
};

export const updateLeadStatusHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = leadParamsSchema.parse(req.params);
        const body = updateLeadStatusSchema.parse(req.body);

        const existing = await getLeadById(id);
        assertLeadClinicAccess(
            existing.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.employee?.clinicId
        );

        const lead = await updateLeadStatus(id, body.status);
        return res.status(200).json({ success: true, data: lead });
    } catch (error) {
        return handleError(res, error);
    }
};

export const updateLeadHandler = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = leadParamsSchema.parse(req.params);
        const body = updateLeadSchema.parse(req.body);

        const existing = await getLeadById(id);
        assertLeadClinicAccess(
            existing.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.employee?.clinicId
        );

        if (
            body.clinicId &&
            !hasPlatformAdminAccess(req.employee) &&
            body.clinicId !== req.employee?.clinicId
        ) {
            return res.status(403).json({
                success: false,
                message: "You cannot modify leads from another clinic",
            });
        }

        const lead = await updateLead(id, body);
        return res.status(200).json({ success: true, data: lead });
    } catch (error) {
        return handleError(res, error);
    }
};

export const bookLeadAppointmentHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = leadParamsSchema.parse(req.params);
        const body = bookLeadAppointmentSchema.parse(req.body);

        const existing = await getLeadById(id);
        assertLeadClinicAccess(
            existing.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.employee?.clinicId
        );

        const lead = await bookLeadAppointment(id, body);
        return res.status(200).json({ success: true, data: lead });
    } catch (error) {
        return handleError(res, error);
    }
};

export const convertLeadToPatientHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = leadParamsSchema.parse(req.params);
        const body = convertLeadToPatientSchema.parse(req.body);

        const existing = await getLeadById(id);
        assertLeadClinicAccess(
            existing.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.employee?.clinicId
        );

        const lead = await convertLeadToPatient(id, body.patientId);
        return res.status(200).json({ success: true, data: lead });
    } catch (error) {
        return handleError(res, error);
    }
};
