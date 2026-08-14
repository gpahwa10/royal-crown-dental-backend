import { describe, expect, it } from "vitest";
import { parseClinicId } from "./app.config";

const VALID_ID = "7bd1c9c8-b192-425c-805b-c07aa15cb5ed";

describe("parseClinicId", () => {
    it("accepts a valid UUID", () => {
        expect(parseClinicId(VALID_ID)).toBe(VALID_ID);
    });

    it("rejects a missing value", () => {
        expect(() => parseClinicId(undefined)).toThrow("CLINIC_ID is required");
        expect(() => parseClinicId("")).toThrow("CLINIC_ID is required");
    });

    it("rejects an invalid UUID", () => {
        expect(() => parseClinicId("not-a-uuid")).toThrow(
            "CLINIC_ID must be a valid UUID"
        );
    });
});
