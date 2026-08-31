import { describe, expect, it } from "vitest";
import { calculateInvoiceLines } from "./billing.calculator";

const serviceA = {
    serviceId: "11111111-1111-1111-1111-111111111111",
    serviceCode: "CLEAN",
    serviceName: "Cleaning",
};

const serviceB = {
    serviceId: "22222222-2222-2222-2222-222222222222",
    serviceCode: "CONSULT",
    serviceName: "Consultation",
};

describe("calculateInvoiceLines", () => {
    it("calculates totals for non-taxable invoice items with unitPrice", () => {
        const result = calculateInvoiceLines(
            [{ serviceId: serviceB.serviceId, quantity: 1, unitPrice: 5000 }],
            [serviceB],
            new Map(),
            0
        );

        expect(result.lines[0]?.taxAmount).toBe(0);
        expect(result.taxAmount).toBe(0);
        expect(result.grandTotal).toBe(5000);
    });

    it("applies tax when taxPercentage is provided on the invoice line item", () => {
        const result = calculateInvoiceLines(
            [{ serviceId: serviceA.serviceId, quantity: 1, unitPrice: 10000, taxPercentage: 18 }],
            [serviceA],
            new Map(),
            0
        );

        expect(result.lines[0]?.taxAmount).toBe(1800);
        expect(result.grandTotal).toBe(11800);
    });

    it("applies membership discount and manual discount correctly", () => {
        const benefits = new Map([
            [
                "CLEAN",
                {
                    serviceCode: "CLEAN",
                    discountType: "percentage" as const,
                    discountValue: 20,
                },
            ],
        ]);
        const result = calculateInvoiceLines(
            [{ serviceId: serviceA.serviceId, quantity: 1, unitPrice: 10000, taxPercentage: 18 }],
            [serviceA],
            benefits,
            500
        );

        expect(result.membershipDiscount).toBe(2000);
        expect(result.lines[0]?.taxAmount).toBe(1440);
        expect(result.manualDiscount).toBe(500);
        expect(result.grandTotal).toBe(8940);
    });

    it("supports custom manual line items with direct serviceName and unitPrice", () => {
        const result = calculateInvoiceLines(
            [
                {
                    serviceName: "Custom Retainer Adjustment",
                    quantity: 2,
                    unitPrice: 1500,
                    taxPercentage: 0,
                },
            ],
            [],
            new Map(),
            100
        );

        expect(result.lines[0]?.serviceName).toBe("Custom Retainer Adjustment");
        expect(result.lines[0]?.serviceId).toBeNull();
        expect(result.lines[0]?.lineTotal).toBe(3000);
        expect(result.subtotal).toBe(3000);
        expect(result.manualDiscount).toBe(100);
        expect(result.grandTotal).toBe(2900);
    });
});
