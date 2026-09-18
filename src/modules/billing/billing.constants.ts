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
    "mpesa",
] as const;

export const normalizePaymentMethodInput = (value: unknown): unknown => {
    if (typeof value !== "string") {
        return value;
    }

    const trimmed = value.trim().toLowerCase();
    // Strip spaces, hyphens, underscores, periods, and unicode dashes.
    const compact = trimmed.replace(/[^a-z0-9]/g, "");

    // MPesa is often sent as UI copy: M‑Pesa, Lipa Na M-Pesa, Mobile Money.
    if (compact.includes("mpesa") || compact === "mobilemoney") {
        return "mpesa";
    }

    const aliases: Record<string, (typeof PAYMENT_METHODS)[number]> = {
        cash: "cash",
        upi: "upi",
        card: "card",
        creditcard: "card",
        debitcard: "card",
        finance: "finance",
        banktransfer: "bank_transfer",
        bank: "bank_transfer",
        cheque: "cheque",
        check: "cheque",
    };

    return aliases[compact] ?? trimmed;
};

export const INVOICE_NUMBER_PREFIX = "INV";
export const INVOICE_NUMBER_PAD_LENGTH = 6;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export type InvoiceSourceType = (typeof INVOICE_SOURCE_TYPES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
