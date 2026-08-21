import { describe, expect, it } from "vitest";
import { calculateInvoiceLines } from "./billing.calculator";

const taxableService = {
    serviceId: "11111111-1111-1111-1111-111111111111",
    serviceCode: "CLEAN",
    serviceName: "Cleaning",
    unitPrice: 10000,
    taxPercentage: 18,
    isTaxable: true,
};

const nonTaxableWithStoredRate = {
    serviceId: "22222222-2222-2222-2222-222222222222",
    serviceCode: "CONSULT",
    serviceName: "Consultation",
    unitPrice: 5000,
    taxPercentage: 18,
    isTaxable: false,
};

describe("calculateInvoiceLines", () => {
    it("does not throw when a non-taxable service still has a tax percentage stored", () => {
        expect(() =>
            calculateInvoiceLines(
                [{ serviceId: nonTaxableWithStoredRate.serviceId, quantity: 1 }],
                [nonTaxableWithStoredRate],
                new Map(),
                0
            )
        ).not.toThrow();
    });

    it("applies zero tax for non-taxable services even if taxPercentage is set", () => {
        const result = calculateInvoiceLines(
            [{ serviceId: nonTaxableWithStoredRate.serviceId, quantity: 1 }],
            [nonTaxableWithStoredRate],
            new Map(),
            0
        );

        expect(result.lines[0]?.taxAmount).toBe(0);
        expect(result.taxAmount).toBe(0);
        expect(result.grandTotal).toBe(5000);
    });

    it("still applies tax for taxable services", () => {
        const result = calculateInvoiceLines(
            [{ serviceId: taxableService.serviceId, quantity: 1 }],
            [taxableService],
            new Map(),
            0
        );

        expect(result.lines[0]?.taxAmount).toBe(1800);
        expect(result.grandTotal).toBe(11800);
    });
});
