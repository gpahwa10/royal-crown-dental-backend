import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import {
    hasPlatformAdminAccess,
} from "../auth/auth.constants";
import { getPatientDetails } from "../patients/patients.service";
import { assertPatientClinicAccess } from "../patients/patients.utils";
import {
    cancelInvoice,
    createInvoice,
    getInvoiceById,
    listInvoices,
    listInvoicesByPatientId,
    recordInvoicePayment,
    updateInvoice,
} from "./billing.service";
import {
    assertFinancialWriteAccess,
    assertInvoiceClinicAccess,
    handleError,
} from "./billing.utils";
import {
    cancelInvoiceSchema,
    createInvoicePaymentSchema,
    createInvoiceSchema,
    invoiceIdParamSchema,
    invoiceListQuerySchema,
    patientIdParamSchema,
    updateInvoiceSchema,
} from "./billing.validation";

const resolveClinicId = (
    req: AuthRequest,
    _requestedClinicId?: string
): string | undefined => {
    return req.clinicId;
};

export const createInvoiceHandler = async (req: AuthRequest, res: Response) => {
    try {
        assertFinancialWriteAccess(req);
        const body = createInvoiceSchema.parse(req.body);

        const clinicId = req.clinicId;

        if (!clinicId) {
            return res.status(400).json({
                success: false,
                message: "clinicId is required",
            });
        }

        const invoice = await createInvoice({
            ...body,
            clinicId,
            generatedBy: req.employee?.isSuperAdmin
                ? undefined
                : req.employee?.id,
        });

        return res.status(201).json({ success: true, data: invoice });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listInvoicesHandler = async (req: AuthRequest, res: Response) => {
    try {
        const query = invoiceListQuerySchema.parse(req.query);
        const clinicId = resolveClinicId(req, query.clinicId);

        const result = await listInvoices({
            page: query.page,
            limit: query.limit,
            clinicId,
            patientId: query.patientId,
            status: query.status,
            search: query.search,
        });

        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getInvoiceHandler = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = invoiceIdParamSchema.parse(req.params);
        const invoice = await getInvoiceById(id);

        assertInvoiceClinicAccess(
            invoice.invoice.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.clinicId
        );

        return res.status(200).json({ success: true, data: invoice });
    } catch (error) {
        return handleError(res, error);
    }
};

export const updateInvoiceHandler = async (req: AuthRequest, res: Response) => {
    try {
        assertFinancialWriteAccess(req);
        const { id } = invoiceIdParamSchema.parse(req.params);
        const body = updateInvoiceSchema.parse(req.body);

        const existing = await getInvoiceById(id);
        assertInvoiceClinicAccess(
            existing.invoice.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.clinicId
        );

        const invoice = await updateInvoice(id, body);
        return res.status(200).json({ success: true, data: invoice });
    } catch (error) {
        return handleError(res, error);
    }
};

export const cancelInvoiceHandler = async (req: AuthRequest, res: Response) => {
    try {
        assertFinancialWriteAccess(req);
        const { id } = invoiceIdParamSchema.parse(req.params);
        cancelInvoiceSchema.parse(req.body);

        const existing = await getInvoiceById(id);
        assertInvoiceClinicAccess(
            existing.invoice.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.clinicId
        );

        const invoice = await cancelInvoice(id);
        return res.status(200).json({ success: true, data: invoice });
    } catch (error) {
        return handleError(res, error);
    }
};

export const createInvoicePaymentHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        assertFinancialWriteAccess(req);
        const { id } = invoiceIdParamSchema.parse(req.params);
        const body = createInvoicePaymentSchema.parse(req.body);

        const existing = await getInvoiceById(id);
        assertInvoiceClinicAccess(
            existing.invoice.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.clinicId
        );

        const result = await recordInvoicePayment(id, {
            ...body,
            receivedBy: req.employee?.isSuperAdmin
                ? undefined
                : req.employee?.id,
        });

        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listPatientInvoicesHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { patientId } = patientIdParamSchema.parse(req.params);
        const patientDetails = await getPatientDetails(patientId);

        assertPatientClinicAccess(
            patientDetails.patient.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.clinicId
        );

        const invoices = await listInvoicesByPatientId(patientId);
        return res.status(200).json({ success: true, data: invoices });
    } catch (error) {
        return handleError(res, error);
    }
};
