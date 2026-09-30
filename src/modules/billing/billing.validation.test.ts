import { describe, expect, it } from "vitest";
import { createInvoiceSchema, invoiceLineItemSchema } from "./billing.validation";

describe("billing.validation", () => {
    it("parses line item with default unitPrice when unitPrice is not provided", () => {
        const result = invoiceLineItemSchema.parse({
            serviceName: "Consultation",
        });

        expect(result.unitPrice).toBe(0);
        expect(result.quantity).toBe(1);
        expect(result.taxPercentage).toBe(0);
        expect(result.serviceName).toBe("Consultation");
    });

    it("parses createInvoiceSchema with items omitting unitPrice without NaN error", () => {
        const payload = {
            patientId: "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d",
            items: [
                {
                    serviceName: "Dental Checkup",
                },
            ],
        };

        const result = createInvoiceSchema.parse(payload);
        expect(result.items[0]?.unitPrice).toBe(0);
        expect(result.items[0]?.quantity).toBe(1);
    });

    it("parses line item with explicitly provided unitPrice as number or string", () => {
        const result = invoiceLineItemSchema.parse({
            serviceName: "Scaling",
            unitPrice: "2500",
            quantity: "2",
        });

        expect(result.unitPrice).toBe(2500);
        expect(result.quantity).toBe(2);
    });

    it("parses line item with price alias and per-item discountAmount", () => {
        const result = invoiceLineItemSchema.parse({
            serviceName: "Root Canal",
            price: 6000,
            discountAmount: 1000,
        });

        expect(result.unitPrice).toBe(6000);
        expect(result.discountAmount).toBe(1000);
        expect(result.quantity).toBe(1);
    });

    it("accepts billedAt on create and rejects future billedAt", () => {
        const past = createInvoiceSchema.parse({
            patientId: "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d",
            billedAt: "2024-11-03T10:30:00.000Z",
            sourceType: "consultation",
            sourceId: "b2c3d4e5-f6a1-4b2c-9d3e-4f5a6b7c8d9e",
            items: [{ serviceName: "Consultation", unitPrice: 500 }],
        });
        expect(past.billedAt?.toISOString()).toBe("2024-11-03T10:30:00.000Z");

        expect(() =>
            createInvoiceSchema.parse({
                patientId: "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d",
                billedAt: new Date(Date.now() + 86_400_000).toISOString(),
                items: [{ serviceName: "Consultation", unitPrice: 500 }],
            })
        ).toThrow(/billedAt cannot be in the future/);
    });
});
