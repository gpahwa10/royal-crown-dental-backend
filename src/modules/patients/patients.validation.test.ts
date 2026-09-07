import { describe, expect, it } from "vitest";
import {
    createPatientSchema,
    updatePatientBasicDetailsSchema,
    updatePatientSchema,
} from "./patients.validation";

describe("patient update doctor assignment validation", () => {
    const doctorId = "7bd1c9c8-b192-425c-805b-c07aa15cb5ed";

    it("accepts doctorId on basic details updates", () => {
        const parsed = updatePatientBasicDetailsSchema.parse({ doctorId });
        expect(parsed.doctorId).toBe(doctorId);
    });

    it("accepts null doctorId to unassign a doctor", () => {
        const parsed = updatePatientBasicDetailsSchema.parse({ doctorId: null });
        expect(parsed.doctorId).toBeNull();
    });

    it("accepts doctorId on combined updates", () => {
        const parsed = updatePatientSchema.parse({ doctorId });
        expect(parsed.doctorId).toBe(doctorId);
    });

    it("accepts doctorId on patient registration", () => {
        const parsed = createPatientSchema.parse({
            patientType: "new",
            name: "Patient One",
            phone: "9999999999",
            email: "patient1@example.com",
            doctorId,
            gender: "Male",
            dateOfBirth: "1990-01-01",
            treatmentConsentSigned: true,
            privacyAccepted: true,
        });

        expect(parsed.doctorId).toBe(doctorId);
    });
});
