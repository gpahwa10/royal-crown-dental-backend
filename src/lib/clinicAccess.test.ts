import { describe, expect, it } from "vitest";
import { assertSameClinic } from "./clinicAccess";

const CLINIC_A = "7bd1c9c8-b192-425c-805b-c07aa15cb5ed";
const CLINIC_B = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("assertSameClinic", () => {
    it("allows matching clinic IDs", () => {
        expect(() =>
            assertSameClinic(CLINIC_A, CLINIC_A, "mismatch")
        ).not.toThrow();
    });

    it("rejects a resource from another clinic", () => {
        expect(() =>
            assertSameClinic(CLINIC_B, CLINIC_A, "You cannot access another clinic")
        ).toThrow("You cannot access another clinic");
    });
});
