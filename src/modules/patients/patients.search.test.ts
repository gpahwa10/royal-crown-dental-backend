import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { clinics } from "../../db/schema/clinic";
import { patients } from "../../db/schema/patients";
import { listPatients } from "./patients.service";
import { nationalMobileSuffix } from "./patients.utils";

describe("national mobile suffix", () => {
    it("treats a number with a country code, a leading zero, and the local number as the same mobile", () => {
        const withCountryCode = nationalMobileSuffix("+254722901521");

        expect(withCountryCode).toBe("722901521");
        expect(nationalMobileSuffix("0722901521")).toBe(withCountryCode);
        expect(nationalMobileSuffix("722901521")).toBe(withCountryCode);
        expect(nationalMobileSuffix("+254 722 901 521")).toBe(withCountryCode);
    });
});

describe("patient phone search ignores country code", () => {
    const unique = Date.now().toString();
    let clinicId: string;
    let patientId: string;

    beforeAll(async () => {
        const [clinic] = await db
            .insert(clinics)
            .values({
                clinicName: `Phone Search Clinic ${unique}`,
                clinicCode: `PHSEARCH${unique}`.slice(0, 50),
                isActive: true,
            })
            .returning();
        clinicId = clinic.id;

        const [patient] = await db
            .insert(patients)
            .values({
                clinicId,
                patientCode: `PH${unique}`.slice(0, 50),
                name: `Phone Search ${unique}`,
                phone: "+254722901521",
                gender: "Female",
                dateOfBirth: new Date("1991-04-04"),
            })
            .returning();
        patientId = patient.id;
    });

    afterAll(async () => {
        await db.delete(patients).where(eq(patients.id, patientId));
        await db.delete(clinics).where(eq(clinics.id, clinicId));
    });

    it("returns the same patient with and without the country code", async () => {
        const withCountryCode = await listPatients({
            clinicId,
            search: "+254722901521",
        });
        const withoutCountryCode = await listPatients({
            clinicId,
            search: "722901521",
        });
        const withTrunkZero = await listPatients({
            clinicId,
            search: "0722901521",
        });

        const ids = (result: { items: { id: string }[] }) =>
            result.items.map((item) => item.id).sort();

        expect(ids(withCountryCode)).toEqual([patientId]);
        expect(ids(withoutCountryCode)).toEqual(ids(withCountryCode));
        expect(ids(withTrunkZero)).toEqual(ids(withCountryCode));
    });
});
