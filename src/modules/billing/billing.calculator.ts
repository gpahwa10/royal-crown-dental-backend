import { MembershipDiscountType } from "../membership/membership.constants";

export type InvoiceLineInput = {
    serviceId: string;
    quantity: number;
};

export type ServicePriceSnapshot = {
    serviceId: string;
    serviceCode: string;
    serviceName: string;
    unitPrice: number;
    taxPercentage: number;
    isTaxable: boolean;
};

export type MembershipBenefitSnapshot = {
    serviceCode: string;
    discountType: MembershipDiscountType;
    discountValue: number;
};

export type CalculatedInvoiceLine = {
    serviceId: string;
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
    services: ServicePriceSnapshot[],
    benefitsByServiceCode: Map<string, MembershipBenefitSnapshot>,
    manualDiscount: number
) => {
    const serviceById = new Map(services.map((service) => [service.serviceId, service]));
    const calculatedLines: CalculatedInvoiceLine[] = [];
    let membershipDiscountTotal = 0;
    let subtotalBeforeTax = 0;
    let taxAmountTotal = 0;

    for (const item of items) {
        const service = serviceById.get(item.serviceId);
        if (!service) {
            throw new Error("Service not found");
        }

        if (!service.isTaxable && service.taxPercentage > 0) {
            throw new Error("Invalid discount configuration");
        }

        const gross = service.unitPrice * item.quantity;
        const membershipDiscount = applyMembershipDiscount(
            gross,
            benefitsByServiceCode.get(service.serviceCode)
        );
        membershipDiscountTotal += membershipDiscount;

        const netBeforeTax = Math.max(0, gross - membershipDiscount);
        const taxAmount = service.isTaxable
            ? Math.round((netBeforeTax * service.taxPercentage) / 100)
            : 0;
        const lineTotal = netBeforeTax + taxAmount;

        subtotalBeforeTax += netBeforeTax;
        taxAmountTotal += taxAmount;

        calculatedLines.push({
            serviceId: service.serviceId,
            serviceName: service.serviceName,
            quantity: item.quantity,
            unitPrice: service.unitPrice,
            discountAmount: membershipDiscount,
            taxPercentage: service.taxPercentage,
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
