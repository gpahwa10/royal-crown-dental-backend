import { describe, expect, it } from "vitest";
import { normalizePaymentMethodInput } from "./billing.constants";
import { paymentMethodSchema } from "./billing.validation";

describe("paymentMethodSchema", () => {
    it("accepts mpesa", () => {
        expect(paymentMethodSchema.parse("mpesa")).toBe("mpesa");
    });

    it("accepts Mpesa / M-Pesa style labels from the billing UI", () => {
        expect(paymentMethodSchema.parse("Mpesa")).toBe("mpesa");
        expect(paymentMethodSchema.parse("MPesa")).toBe("mpesa");
        expect(paymentMethodSchema.parse("M-Pesa")).toBe("mpesa");
        expect(paymentMethodSchema.parse("m-pesa")).toBe("mpesa");
    });

    it("accepts unicode hyphen and Lipa Na M-Pesa style labels", () => {
        expect(paymentMethodSchema.parse("M‑Pesa")).toBe("mpesa"); // en-dash
        expect(paymentMethodSchema.parse("M—Pesa")).toBe("mpesa"); // em-dash
        expect(paymentMethodSchema.parse("M.Pesa")).toBe("mpesa");
        expect(paymentMethodSchema.parse("Lipa Na M-Pesa")).toBe("mpesa");
        expect(paymentMethodSchema.parse("Mpesa Payment")).toBe("mpesa");
        expect(paymentMethodSchema.parse("Mobile Money")).toBe("mpesa");
    });

    it("still accepts existing methods", () => {
        expect(paymentMethodSchema.parse("cash")).toBe("cash");
        expect(paymentMethodSchema.parse("upi")).toBe("upi");
    });

    it("accepts Bank Transfer style labels from the billing UI", () => {
        expect(paymentMethodSchema.parse("Bank Transfer")).toBe("bank_transfer");
        expect(paymentMethodSchema.parse("bank-transfer")).toBe("bank_transfer");
        expect(paymentMethodSchema.parse("banktransfer")).toBe("bank_transfer");
    });

    it("accepts common card and cheque aliases", () => {
        expect(paymentMethodSchema.parse("Credit Card")).toBe("card");
        expect(paymentMethodSchema.parse("check")).toBe("cheque");
        expect(paymentMethodSchema.parse("Cheque")).toBe("cheque");
    });
});

describe("normalizePaymentMethodInput", () => {
    it("maps compact mpesa spellings", () => {
        expect(normalizePaymentMethodInput("Mpesa")).toBe("mpesa");
        expect(normalizePaymentMethodInput("M Pesa")).toBe("mpesa");
    });

    it("maps bank transfer and credit card labels", () => {
        expect(normalizePaymentMethodInput("Bank Transfer")).toBe(
            "bank_transfer"
        );
        expect(normalizePaymentMethodInput("Credit Card")).toBe("card");
    });
});
