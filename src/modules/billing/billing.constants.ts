export const INVOICE_STATUSES = [
    "draft",
    "pending",
    "partially_paid",
    "paid",
    "cancelled",
    "refunded",
] as const;

export const INVOICE_SOURCE_TYPES = [
    "consultation",
    "lab_request",
    "radiograph",
    "dental_lab",
    "membership",
    "manual",
] as const;

export const PAYMENT_METHODS = [
    "cash",
    "upi",
    "card",
    "finance",
    "bank_transfer",
    "cheque",
] as const;

export const INVOICE_NUMBER_PREFIX = "INV";
export const INVOICE_NUMBER_PAD_LENGTH = 6;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export type InvoiceSourceType = (typeof INVOICE_SOURCE_TYPES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
