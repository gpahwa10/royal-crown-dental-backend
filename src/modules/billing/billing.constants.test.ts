import { describe, expect, it } from "vitest";
import { normalizePaymentMethodInput } from "./billing.constants";
import { paymentMethodSchema } from "./billing.validation";

describe("paymentMethodSchema", () => {
    it("accepts mpesa", () => {
        expect(paymentMethodSchema.parse("mpesa")).toBe("mpesa");
    });

    it("accepts M-Pesa style labels from the billing UI", () => {
        expect(paymentMethodSchema.parse("MPesa")).toBe("mpesa");
        expect(paymentMethodSchema.parse("M-Pesa")).toBe("mpesa");
        expect(paymentMethodSchema.parse("m-pesa")).toBe("mpesa");
    });

    it("still accepts existing methods", () => {
        expect(paymentMethodSchema.parse("cash")).toBe("cash");
        expect(paymentMethodSchema.parse("upi")).toBe("upi");
    });
});

describe("normalizePaymentMethodInput", () => {
    it("maps compact mpesa spellings", () => {
        expect(normalizePaymentMethodInput("M Pesa")).toBe("mpesa");
    });
});
