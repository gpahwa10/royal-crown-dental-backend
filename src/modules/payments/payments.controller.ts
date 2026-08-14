import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { hasPlatformAdminAccess } from "../auth/auth.constants";
import {
    getInvoiceById,
    getInvoicePayments,
    getPaymentById,
} from "./payments.service";
import { assertInvoiceClinicAccess, handleError } from "./payments.utils";
import { invoiceIdParamSchema, paymentIdParamSchema } from "./payments.validation";

export const listInvoicePaymentsHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = invoiceIdParamSchema.parse(req.params);
        const invoice = await getInvoiceById(id);

        assertInvoiceClinicAccess(
            invoice.invoice.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.clinicId
        );

        const paymentRows = await getInvoicePayments(id);
        return res.status(200).json({ success: true, data: paymentRows });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getPaymentHandler = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = paymentIdParamSchema.parse(req.params);
        const result = await getPaymentById(id);

        assertInvoiceClinicAccess(
            result.invoice.invoice.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.clinicId
        );

        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};
