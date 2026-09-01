import "dotenv/config";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { db } from "../../db/client";
import { clinics } from "../../db/schema/clinic";
import { patients } from "../../db/schema/patients";
import { employees } from "../../db/schema/employees";
import { consultations } from "../../db/schema/consultations";
import { patientOdontograms } from "../../db/schema/patientOdontograms";
import { consultationOdontograms } from "../../db/schema/consultationOdontograms";
import { odontogramChanges } from "../../db/schema/odontogramChanges";
import {
    diffOdontogramCharts,
    finalizeConsultationOdontogram,
    getConsultationOdontogram,
    getPatientCurrentOdontogram,
    initializeConsultationOdontogram,
    OdontogramError,
    updateConsultationOdontogram,
} from "./odontograms.service";
import {
    completeConsultation,
    getConsultationById,
    listConsultationsByPatientId,
    startConsultation,
} from "../consultations/consultations.service";
import { eq, inArray } from "drizzle-orm";

describe("Odontogram Service & Cumulative Patient Chart Tests", () => {
    let testClinicId: string;
    let otherClinicId: string;
    let doctorId: string;
    let patientId: string;
    let otherPatientId: string;

    const createdConsultationIds: string[] = [];

    beforeAll(async () => {
        // Create test clinic A
        const [clinicA] = await db
            .insert(clinics)
            .values({
                clinicName: "Odontogram Test Clinic A",
                clinicCode: `ODON_TEST_A_${Date.now()}`,
                isActive: true,
            })
            .returning();
        testClinicId = clinicA.id;

        // Create test clinic B
        const [clinicB] = await db
            .insert(clinics)
            .values({
                clinicName: "Odontogram Test Clinic B",
                clinicCode: `ODON_TEST_B_${Date.now()}`,
                isActive: true,
            })
            .returning();
        otherClinicId = clinicB.id;

        // Create doctor
        const [doc] = await db
            .insert(employees)
            .values({
                clinicId: testClinicId,
                name: "Dr. Dental Tester",
                email: `dr_tester_${Date.now()}@example.com`,
                password: "hashedpassword",
                designation: "Doctor",
                isActive: true,
            })
            .returning();
        doctorId = doc.id;

        // Create test patient
        const [pat] = await db
            .insert(patients)
            .values({
                clinicId: testClinicId,
                patientCode: `P_TEST_${Date.now()}`,
                name: "Test Patient P001",
                phone: "1234567890",
                gender: "Male",
                dateOfBirth: new Date("1990-01-01"),
                isActive: true,
            })
            .returning();
        patientId = pat.id;

        // Create other clinic patient
        const [otherPat] = await db
            .insert(patients)
            .values({
                clinicId: otherClinicId,
                patientCode: `P_OTHER_${Date.now()}`,
                name: "Other Clinic Patient",
                phone: "9876543210",
                gender: "Female",
                dateOfBirth: new Date("1995-05-05"),
                isActive: true,
            })
            .returning();
        otherPatientId = otherPat.id;
    });

    afterAll(async () => {
        // Cleanup all records created in test clinics
        try {
            await db
                .delete(odontogramChanges)
                .where(inArray(odontogramChanges.clinicId, [testClinicId, otherClinicId]));
            await db
                .delete(consultationOdontograms)
                .where(inArray(consultationOdontograms.clinicId, [testClinicId, otherClinicId]));
            await db
                .delete(consultations)
                .where(inArray(consultations.clinicId, [testClinicId, otherClinicId]));
            await db
                .delete(patientOdontograms)
                .where(inArray(patientOdontograms.clinicId, [testClinicId, otherClinicId]));
            await db
                .delete(patients)
                .where(inArray(patients.clinicId, [testClinicId, otherClinicId]));
            await db
                .delete(employees)
                .where(inArray(employees.clinicId, [testClinicId, otherClinicId]));
            await db
                .delete(clinics)
                .where(inArray(clinics.id, [testClinicId, otherClinicId]));
        } catch (e) {
            console.error("Cleanup error:", e);
        }
    });

    it("Diffing logic accurately detects tooth-level and chart-level changes", () => {
        const prevStatus = { "16": { condition: "sound" } };
        const newStatus = { "16": { condition: "caries" }, "36": { condition: "rct" } };

        const changes = diffOdontogramCharts(prevStatus, newStatus, {}, {});
        expect(changes.length).toBe(2);

        const tooth16 = changes.find((c) => c.toothNumber === "16");
        expect(tooth16).toBeDefined();
        expect(tooth16?.changeType).toBe("status_chart_updated");
        expect(tooth16?.previousState).toEqual({ condition: "sound" });
        expect(tooth16?.newState).toEqual({ condition: "caries" });

        const tooth36 = changes.find((c) => c.toothNumber === "36");
        expect(tooth36).toBeDefined();
        expect(tooth36?.previousState).toBeNull();
        expect(tooth36?.newState).toEqual({ condition: "rct" });
    });

    it("Test 1 — initialize empty patient chart for draft consultation", async () => {
        const [c1] = await db
            .insert(consultations)
            .values({
                consultationCode: `C_TEST_1_${Date.now()}`,
                clinicId: testClinicId,
                patientId: patientId,
                doctorId: doctorId,
                chiefComplaint: "Routine Checkup",
                status: "draft",
            })
            .returning();
        createdConsultationIds.push(c1.id);

        const chart = await initializeConsultationOdontogram(c1.id, testClinicId);
        expect(chart).toBeDefined();
        expect(chart.consultationId).toBe(c1.id);
        expect(chart.patientId).toBe(patientId);
        expect(chart.chartVersion).toBe(1);
        expect(chart.statusChart).toEqual({});
        expect(chart.readOnly).toBe(false);
    });

    it("Test 2 & 11 — initialization is idempotent and does not overwrite working edits", async () => {
        const [c1] = await db
            .insert(consultations)
            .values({
                consultationCode: `C_TEST_2_${Date.now()}`,
                clinicId: testClinicId,
                patientId: patientId,
                doctorId: doctorId,
                chiefComplaint: "Tooth pain",
                status: "in_progress",
            })
            .returning();
        createdConsultationIds.push(c1.id);

        // First initialization
        const firstInit = await initializeConsultationOdontogram(c1.id, testClinicId);
        expect(firstInit.chartVersion).toBe(1);

        // Doctor makes an edit
        await updateConsultationOdontogram(
            c1.id,
            {
                statusChart: { "16": { condition: "caries" } },
                planChart: {},
                version: 1,
            },
            testClinicId,
            doctorId
        );

        // Second initialization call must return the existing working record without resetting
        const secondInit = await initializeConsultationOdontogram(c1.id, testClinicId);
        expect(secondInit.chartVersion).toBe(2);
        expect(secondInit.statusChart).toEqual({ "16": { condition: "caries" } });
    });

    it("Test 3 — consultation changes do not immediately overwrite patient chart", async () => {
        // Current patient chart is currently null or empty
        const patientChartBefore = await getPatientCurrentOdontogram(patientId, testClinicId);
        expect(patientChartBefore).toBeNull();

        const [c1] = await db
            .insert(consultations)
            .values({
                consultationCode: `C_TEST_3_${Date.now()}`,
                clinicId: testClinicId,
                patientId: patientId,
                doctorId: doctorId,
                chiefComplaint: "Checkup",
                status: "in_progress",
            })
            .returning();
        createdConsultationIds.push(c1.id);

        await initializeConsultationOdontogram(c1.id, testClinicId);
        await updateConsultationOdontogram(
            c1.id,
            {
                statusChart: { "16": { condition: "caries" } },
                planChart: {},
                version: 1,
            },
            testClinicId,
            doctorId
        );

        // Patient current chart must remain null/unchanged before completion
        const patientChartAfter = await getPatientCurrentOdontogram(patientId, testClinicId);
        expect(patientChartAfter).toBeNull();
    });

    it("Test 4 — completing consultation updates patient chart atomically", async () => {
        const [c1] = await db
            .insert(consultations)
            .values({
                consultationCode: `C_TEST_4_${Date.now()}`,
                clinicId: testClinicId,
                patientId: patientId,
                doctorId: doctorId,
                chiefComplaint: "Filling",
                diagnosis: "Dental Caries on 16",
                status: "in_progress",
            })
            .returning();
        createdConsultationIds.push(c1.id);

        await initializeConsultationOdontogram(c1.id, testClinicId);
        await updateConsultationOdontogram(
            c1.id,
            {
                statusChart: { "16": { condition: "caries" } },
                planChart: {},
                version: 1,
            },
            testClinicId,
            doctorId
        );

        // Complete consultation
        await completeConsultation(c1.id);

        // Patient chart must now have 16 -> caries and version 1
        const patientChart = await getPatientCurrentOdontogram(patientId, testClinicId);
        expect(patientChart).not.toBeNull();
        expect(patientChart?.statusChart).toEqual({ "16": { condition: "caries" } });
        expect(patientChart?.version).toBe(1);
    });

    it("Test 12 — optimistic locking prevents lost updates (409 Conflict)", async () => {
        const [c] = await db
            .insert(consultations)
            .values({
                consultationCode: `C_TEST_12_${Date.now()}`,
                clinicId: testClinicId,
                patientId: patientId,
                doctorId: doctorId,
                chiefComplaint: "Locking test",
                status: "in_progress",
            })
            .returning();
        createdConsultationIds.push(c.id);

        await initializeConsultationOdontogram(c.id, testClinicId);

        // User A updates chart with version 1 -> DB becomes version 2
        await updateConsultationOdontogram(
            c.id,
            {
                statusChart: { "11": { condition: "normal" } },
                version: 1,
            },
            testClinicId,
            doctorId
        );

        // User B sends update with stale version 1
        await expect(
            updateConsultationOdontogram(
                c.id,
                {
                    statusChart: { "11": { condition: "fracture" } },
                    version: 1,
                },
                testClinicId,
                doctorId
            )
        ).rejects.toThrowError(OdontogramError);

        try {
            await updateConsultationOdontogram(
                c.id,
                {
                    statusChart: { "11": { condition: "fracture" } },
                    version: 1,
                },
                testClinicId,
                doctorId
            );
        } catch (err) {
            const error = err as OdontogramError;
            expect(error.code).toBe("ODONTOGRAM_VERSION_CONFLICT");
            expect(error.status).toBe(409);
        }
    });

    it("Test 9 & 10 — completed consultations can be viewed/edited, cancelled consultations cannot be edited", async () => {
        const [comp] = await db
            .insert(consultations)
            .values({
                consultationCode: `C_COMP_${Date.now()}`,
                clinicId: testClinicId,
                patientId: patientId,
                doctorId: doctorId,
                chiefComplaint: "Completed test",
                diagnosis: "Diagnosis",
                status: "in_progress",
            })
            .returning();
        createdConsultationIds.push(comp.id);
        const compInit = await initializeConsultationOdontogram(comp.id, testClinicId);
        await completeConsultation(comp.id);

        // Completed consultation chart CAN now be edited and updates patient current chart
        const updatedComp = await updateConsultationOdontogram(
            comp.id,
            { statusChart: { "21": { condition: "crown" } }, version: compInit.chartVersion },
            testClinicId,
            doctorId
        );
        expect(updatedComp.statusChart).toEqual({ "21": { condition: "crown" } });

        const patChart = await getPatientCurrentOdontogram(patientId, testClinicId);
        expect(patChart?.statusChart).toEqual({ "21": { condition: "crown" } });

        const [canc] = await db
            .insert(consultations)
            .values({
                consultationCode: `C_CANC_${Date.now()}`,
                clinicId: testClinicId,
                patientId: patientId,
                doctorId: doctorId,
                chiefComplaint: "Cancelled test",
                status: "cancelled",
            })
            .returning();
        createdConsultationIds.push(canc.id);

        await expect(
            initializeConsultationOdontogram(canc.id, testClinicId)
        ).rejects.toThrow("Cannot initialize odontogram for cancelled consultation");
    });

    it("Test 13 — clinic isolation prevents cross-clinic access", async () => {
        await expect(
            getPatientCurrentOdontogram(otherPatientId, testClinicId)
        ).rejects.toThrow("You cannot access patient data from another clinic");
    });

    it("Patient consultation history returns rich records with doctor, odontogram, and prescriptions", async () => {
        const history = await listConsultationsByPatientId(patientId);
        expect(Array.isArray(history)).toBe(true);
        expect(history.length).toBeGreaterThan(0);

        const first = history[0];
        expect(first).toHaveProperty("id");
        expect(first).toHaveProperty("status");
        expect(first).toHaveProperty("doctor");
        expect(first).toHaveProperty("odontogram");
        expect(first).toHaveProperty("prescriptions");
    });

    it("Test 15 — transaction rollback on completion failure preserves consistent state", async () => {
        const [cRollback] = await db
            .insert(consultations)
            .values({
                consultationCode: `C_ROLLBACK_${Date.now()}`,
                clinicId: testClinicId,
                patientId: patientId,
                doctorId: doctorId,
                chiefComplaint: "Rollback test",
                diagnosis: "", // Missing diagnosis will fail completion
                status: "in_progress",
            })
            .returning();
        createdConsultationIds.push(cRollback.id);

        await initializeConsultationOdontogram(cRollback.id, testClinicId);
        await updateConsultationOdontogram(
            cRollback.id,
            { statusChart: { "99": "special" }, version: 1 },
            testClinicId,
            doctorId
        );

        const currentPatientChartBefore = await getPatientCurrentOdontogram(patientId, testClinicId);

        // Attempting to complete without diagnosis must fail and rollback
        await expect(completeConsultation(cRollback.id)).rejects.toThrow(
            "Diagnosis is required before completing consultation"
        );

        const currentPatientChartAfter = await getPatientCurrentOdontogram(patientId, testClinicId);
        expect(currentPatientChartAfter?.statusChart).toEqual(currentPatientChartBefore?.statusChart);

        const [cRecord] = await db
            .select()
            .from(consultations)
            .where(eq(consultations.id, cRollback.id));
        expect(cRecord.status).toBe("in_progress");
    });

    it("Test 5, 6, 7, 8 & 32/54 — Cumulative multi-consultation workflow & immutable historical snapshots (C001 -> C002 -> C003)", async () => {
        // Create clean patient for end-to-end scenario
        const [e2ePatient] = await db
            .insert(patients)
            .values({
                clinicId: testClinicId,
                patientCode: `P_E2E_${Date.now()}`,
                name: "E2E Cumulative Patient",
                phone: "5555555555",
                gender: "Female",
                dateOfBirth: new Date("1992-02-02"),
                isActive: true,
            })
            .returning();

        // ----------------------------------------------------
        // 1. Consultation 1 (10 September)
        // ----------------------------------------------------
        const [c1] = await db
            .insert(consultations)
            .values({
                consultationCode: `C001_${Date.now()}`,
                clinicId: testClinicId,
                patientId: e2ePatient.id,
                doctorId: doctorId,
                chiefComplaint: "Toothache upper right",
                diagnosis: "Caries on tooth 16",
                status: "in_progress",
            })
            .returning();
        createdConsultationIds.push(c1.id);

        // Initialize C001
        const c1Init = await initializeConsultationOdontogram(c1.id, testClinicId);
        expect(c1Init.statusChart).toEqual({});

        // Doctor records: Tooth 16 -> Caries
        await updateConsultationOdontogram(
            c1.id,
            {
                statusChart: { "16": { condition: "caries" } },
                planChart: {},
                version: c1Init.chartVersion,
            },
            testClinicId,
            doctorId
        );

        // Complete C001
        await completeConsultation(c1.id);

        // Verify patient current chart after C001
        const patChartAfterC1 = await getPatientCurrentOdontogram(e2ePatient.id, testClinicId);
        expect(patChartAfterC1?.statusChart).toEqual({ "16": { condition: "caries" } });
        expect(patChartAfterC1?.version).toBe(1);

        // ----------------------------------------------------
        // 2. Consultation 2 (14 September)
        // ----------------------------------------------------
        const [c2] = await db
            .insert(consultations)
            .values({
                consultationCode: `C002_${Date.now()}`,
                clinicId: testClinicId,
                patientId: e2ePatient.id,
                doctorId: doctorId,
                chiefComplaint: "Lower left tooth pain",
                diagnosis: "Pulpitis on 36 requiring RCT",
                status: "in_progress",
            })
            .returning();
        createdConsultationIds.push(c2.id);

        // Initialize C002 — MUST automatically copy latest patient chart (16 -> caries)
        const c2Init = await initializeConsultationOdontogram(c2.id, testClinicId);
        expect(c2Init.statusChart).toEqual({ "16": { condition: "caries" } });

        // Doctor records: 36 -> RCT (keeping 16 -> caries)
        const c2Updated = await updateConsultationOdontogram(
            c2.id,
            {
                statusChart: {
                    "16": { condition: "caries" },
                    "36": { condition: "rct" },
                },
                planChart: {},
                version: c2Init.chartVersion,
            },
            testClinicId,
            doctorId
        );
        expect(c2Updated.chartVersion).toBe(2);

        // Complete C002
        await completeConsultation(c2.id);

        // Verify patient current chart after C002
        const patChartAfterC2 = await getPatientCurrentOdontogram(e2ePatient.id, testClinicId);
        expect(patChartAfterC2?.statusChart).toEqual({
            "16": { condition: "caries" },
            "36": { condition: "rct" },
        });
        expect(patChartAfterC2?.version).toBe(2);

        // CRITICAL CHECK: Historical C001 must still only show 16 -> caries and NOT 36
        const c1Historical = await getConsultationById(c1.id);
        expect(c1Historical.odontogram?.statusChart).toEqual({ "16": { condition: "caries" } });
        expect(c1Historical.odontogram?.statusChart).not.toHaveProperty("36");
        expect(c1Historical.odontogram?.readOnly).toBe(false);

        // ----------------------------------------------------
        // 3. Consultation 3 (20 September)
        // ----------------------------------------------------
        const [c3] = await db
            .insert(consultations)
            .values({
                consultationCode: `C003_${Date.now()}`,
                clinicId: testClinicId,
                patientId: e2ePatient.id,
                doctorId: doctorId,
                chiefComplaint: "Upper left restoration",
                diagnosis: "Crown restoration on 26",
                status: "in_progress",
            })
            .returning();
        createdConsultationIds.push(c3.id);

        // Initialize C003 — MUST show 16 -> caries and 36 -> rct
        const c3Init = await initializeConsultationOdontogram(c3.id, testClinicId);
        expect(c3Init.statusChart).toEqual({
            "16": { condition: "caries" },
            "36": { condition: "rct" },
        });

        // Doctor adds: 26 -> Crown
        await updateConsultationOdontogram(
            c3.id,
            {
                statusChart: {
                    "16": { condition: "caries" },
                    "36": { condition: "rct" },
                    "26": { condition: "crown" },
                },
                planChart: {},
                version: c3Init.chartVersion,
            },
            testClinicId,
            doctorId
        );

        // Complete C003
        await completeConsultation(c3.id);

        // Final patient current chart
        const finalPatientChart = await getPatientCurrentOdontogram(e2ePatient.id, testClinicId);
        expect(finalPatientChart?.statusChart).toEqual({
            "16": { condition: "caries" },
            "36": { condition: "rct" },
            "26": { condition: "crown" },
        });
        expect(finalPatientChart?.version).toBe(3);

        // Re-verify ALL historical snapshots:
        // C001 must show ONLY 16
        const c1Final = await getConsultationById(c1.id);
        expect(c1Final.odontogram?.statusChart).toEqual({ "16": { condition: "caries" } });

        // C002 must show 16 and 36 (NOT 26)
        const c2Final = await getConsultationById(c2.id);
        expect(c2Final.odontogram?.statusChart).toEqual({
            "16": { condition: "caries" },
            "36": { condition: "rct" },
        });
        expect(c2Final.odontogram?.statusChart).not.toHaveProperty("26");

        // C003 must show 16, 36, and 26
        const c3Final = await getConsultationById(c3.id);
        expect(c3Final.odontogram?.statusChart).toEqual({
            "16": { condition: "caries" },
            "36": { condition: "rct" },
            "26": { condition: "crown" },
        });
    });

    it("Super Admin (non-employee ID) can successfully update odontogram and record changes", async () => {
        const [superAdminConsultation] = await db
            .insert(consultations)
            .values({
                consultationCode: `C_SUPER_ADMIN_${Date.now()}`,
                clinicId: testClinicId,
                patientId: patientId,
                doctorId: doctorId,
                chiefComplaint: "Super admin edit test",
                status: "in_progress",
            })
            .returning();
        createdConsultationIds.push(superAdminConsultation.id);

        const initChart = await initializeConsultationOdontogram(
            superAdminConsultation.id,
            testClinicId
        );

        const superAdminId = "743c739e-4645-4e0f-8ca1-343e19b0de11";

        const updated = await updateConsultationOdontogram(
            superAdminConsultation.id,
            {
                statusChart: { "11": { condition: "filled" } },
                planChart: { "11": { procedure: "crown" } },
                version: initChart.chartVersion,
            },
            testClinicId,
            superAdminId
        );

        expect(updated).toBeDefined();
        expect(updated.statusChart).toEqual({ "11": { condition: "filled" } });

        const recordedChanges = await db
            .select()
            .from(odontogramChanges)
            .where(eq(odontogramChanges.consultationId, superAdminConsultation.id));

        expect(recordedChanges.length).toBeGreaterThan(0);
        expect(recordedChanges[0].createdBy).toBe(superAdminId);
    });
});

