import { z } from "zod";
import {
    INVOICE_SOURCE_TYPES,
    INVOICE_STATUSES,
    PAYMENT_METHODS,
} from "./billing.constants";

export const invoiceIdParamSchema = z.object({
    id: z.uuid(),
});

export const patientIdParamSchema = z.object({
    patientId: z.uuid(),
});

export const invoiceLineItemSchema = z
    .object({
        serviceId: z.uuid().optional(),
        serviceName: z.string().trim().min(1).optional(),
        quantity: z.coerce.number().int().min(1).default(1),
        unitPrice: z.coerce.number().int().min(0).optional(),
        price: z.coerce.number().int().min(0).optional(),
        discountAmount: z.coerce.number().int().min(0).optional().default(0),
        taxPercentage: z.coerce.number().int().min(0).max(100).optional().default(0),
    })
    .transform((data) => ({
        ...data,
        unitPrice: data.unitPrice ?? data.price ?? 0,
    }))
    .refine((data) => data.serviceId || data.serviceName, {
        message: "Either serviceId or serviceName must be provided",
    });

export const createInvoiceSchema = z.object({
    patientId: z.uuid(),
    clinicId: z.uuid().optional(),
    clinicVisitId: z.uuid().optional(),
    sourceType: z.enum(INVOICE_SOURCE_TYPES).default("manual"),
    sourceId: z.uuid().nullable().optional(),
    manualDiscount: z.coerce.number().int().min(0).default(0),
    items: z.array(invoiceLineItemSchema).min(1),
});

export const updateInvoiceSchema = z.object({
    items: z.array(invoiceLineItemSchema).min(1),
    manualDiscount: z.coerce.number().int().min(0).default(0),
});

export const invoiceListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(INVOICE_STATUSES).optional(),
    clinicId: z.uuid().optional(),
    patientId: z.uuid().optional(),
    search: z.string().trim().optional(),
});

export const cancelInvoiceSchema = z
    .object({
        reason: z.string().trim().optional(),
    })
    .optional()
    .default({});

export const createInvoicePaymentSchema = z.object({
    amount: z.coerce.number().int().positive(),
    paymentMethod: z.enum(PAYMENT_METHODS),
    paymentReference: z.string().trim().optional(),
    paymentDate: z.coerce.date().optional(),
    notes: z.string().trim().optional(),
});

export const paymentIdParamSchema = z.object({
    id: z.uuid(),
});
