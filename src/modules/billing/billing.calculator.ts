import { MembershipDiscountType } from "../membership/membership.constants";

export type InvoiceLineInput = {
    serviceId?: string;
    serviceName?: string;
    quantity: number;
    unitPrice: number;
    taxPercentage?: number;
};

export type ServiceCatalogSnapshot = {
    serviceId: string;
    serviceCode: string;
    serviceName: string;
};

export type ServicePriceSnapshot = ServiceCatalogSnapshot;

export type MembershipBenefitSnapshot = {
    serviceCode: string;
    discountType: MembershipDiscountType;
    discountValue: number;
};

export type CalculatedInvoiceLine = {
    serviceId: string | null;
    serviceName: string;
    quantity: number;
    unitPrice: number;
    discountAmount: number;
    taxPercentage: number;
    taxAmount: number;
    lineTotal: number;
};

export const applyMembershipDiscount = (
    lineSubtotal: number,
    benefit?: MembershipBenefitSnapshot
) => {
    if (!benefit) {
        return 0;
    }

    if (benefit.discountType === "free") {
        return lineSubtotal;
    }

    if (benefit.discountType === "percentage") {
        return Math.round((lineSubtotal * benefit.discountValue) / 100);
    }

    return Math.min(lineSubtotal, benefit.discountValue);
};

export const calculateInvoiceLines = (
    items: InvoiceLineInput[],
    services: ServiceCatalogSnapshot[],
    benefitsByServiceCode: Map<string, MembershipBenefitSnapshot>,
    manualDiscount: number
) => {
    const serviceById = new Map(services.map((service) => [service.serviceId, service]));
    const calculatedLines: CalculatedInvoiceLine[] = [];
    let membershipDiscountTotal = 0;
    let taxAmountTotal = 0;

    for (const item of items) {
        const service = item.serviceId ? serviceById.get(item.serviceId) : undefined;
        if (item.serviceId && !service) {
            throw new Error("Service not found");
        }

        const serviceName = item.serviceName ?? service?.serviceName ?? "Dental Service";
        const effectiveUnitPrice = item.unitPrice ?? 0;
        const gross = effectiveUnitPrice * item.quantity;
        const membershipDiscount = service
            ? applyMembershipDiscount(
                  gross,
                  benefitsByServiceCode.get(service.serviceCode)
              )
            : 0;
        membershipDiscountTotal += membershipDiscount;

        const netBeforeTax = Math.max(0, gross - membershipDiscount);
        const taxPercentage = item.taxPercentage ?? 0;
        const taxAmount =
            taxPercentage > 0
                ? Math.round((netBeforeTax * taxPercentage) / 100)
                : 0;
        const lineTotal = netBeforeTax + taxAmount;

        taxAmountTotal += taxAmount;

        calculatedLines.push({
            serviceId: service?.serviceId ?? item.serviceId ?? null,
            serviceName,
            quantity: item.quantity,
            unitPrice: effectiveUnitPrice,
            discountAmount: membershipDiscount,
            taxPercentage,
            taxAmount,
            lineTotal,
        });
    }

    const subtotal = calculatedLines.reduce(
        (sum, line) => sum + line.unitPrice * line.quantity,
        0
    );
    const linesTotal = calculatedLines.reduce(
        (sum, line) => sum + line.lineTotal,
        0
    );
    const appliedManualDiscount = Math.min(manualDiscount, linesTotal);
    const grandTotal = Math.max(0, linesTotal - appliedManualDiscount);

    return {
        lines: calculatedLines,
        subtotal,
        membershipDiscount: membershipDiscountTotal,
        manualDiscount: appliedManualDiscount,
        taxAmount: taxAmountTotal,
        grandTotal,
    };
};

export const resolveInvoiceStatus = (
    grandTotal: number,
    amountPaid: number,
    currentStatus: string
) => {
    if (currentStatus === "cancelled" || currentStatus === "refunded") {
        return currentStatus;
    }

    if (amountPaid <= 0) {
        return "pending";
    }

    if (amountPaid >= grandTotal) {
        return "paid";
    }

    return "partially_paid";
};
