import "dotenv/config";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { db } from "../../db/client";
import { clinics } from "../../db/schema/clinic";
import { patients } from "../../db/schema/patients";
import { employees } from "../../db/schema/employees";
import { employeeRoles } from "../../db/schema/roles";
import { employeeRoleAssignments } from "../../db/schema/employeeRoleAssignments";
import { appointments } from "../../db/schema/appointments";
import { consultations } from "../../db/schema/consultations";
import { clinicVisits } from "../../db/schema/clinicVisits";
import {
    completeConsultation,
    createConsultation,
    getConsultationById,
    startConsultation,
    updateConsultation,
} from "./consultations.service";
import {
    getAppointmentById,
    updateAppointment,
} from "../appointments/appointments.service";
import { ROLE_DOCTOR } from "../auth/auth.constants";
import { eq, inArray } from "drizzle-orm";

describe("Consultations with Overlapping Doctor Appointments", () => {
    let clinicId: string;
    let doctorId: string;
    let patient1Id: string;
    let patient2Id: string;
    let appointment1Id: string;
    let appointment2Id: string;

    const cleanupConsultationIds: string[] = [];
    const cleanupAppointmentIds: string[] = [];

    beforeAll(async () => {
        // Create test clinic
        const [clinic] = await db
            .insert(clinics)
            .values({
                clinicName: "Overlapping Consultation Test Clinic",
                clinicCode: `OVERLAP_CLINIC_${Date.now()}`,
                isActive: true,
            })
            .returning();
        clinicId = clinic.id;

        // Create doctor
        const [doctor] = await db
            .insert(employees)
            .values({
                clinicId,
                name: "Dr. Overlap Tester",
                email: `dr_overlap_${Date.now()}@example.com`,
                password: "hashedpassword",
                designation: "Doctor",
                isActive: true,
            })
            .returning();
        doctorId = doctor.id;

        // Assign DOCTOR role
        const [role] = await db
            .select()
            .from(employeeRoles)
            .where(eq(employeeRoles.name, ROLE_DOCTOR));
        if (role) {
            await db.insert(employeeRoleAssignments).values({
                employeeId: doctorId,
                roleId: role.id,
            });
        }

        // Create patients
        const [p1] = await db
            .insert(patients)
            .values({
                clinicId,
                patientCode: `P_OVERLAP_1_${Date.now()}`,
                name: "Patient One",
                phone: "1112223334",
                gender: "Male",
                dateOfBirth: new Date("1992-05-10"),
                isActive: true,
            })
            .returning();
        patient1Id = p1.id;

        const [p2] = await db
            .insert(patients)
            .values({
                clinicId,
                patientCode: `P_OVERLAP_2_${Date.now()}`,
                name: "Patient Two",
                phone: "1112223335",
                gender: "Female",
                dateOfBirth: new Date("1995-08-20"),
                isActive: true,
            })
            .returning();
        patient2Id = p2.id;

        // Create two overlapping appointments at the exact same time
        const scheduledTime = new Date("2026-10-20T10:00:00.000Z");

        const [apt1] = await db
            .insert(appointments)
            .values({
                appointmentCode: `APT_OV1_${Date.now()}`,
                clinicId,
                patientId: patient1Id,
                employeeId: doctorId,
                scheduledAt: scheduledTime,
                durationMinutes: 30,
                status: "in_progress",
                appointmentType: "consultation",
            })
            .returning();
        appointment1Id = apt1.id;
        cleanupAppointmentIds.push(apt1.id);

        const [apt2] = await db
            .insert(appointments)
            .values({
                appointmentCode: `APT_OV2_${Date.now()}`,
                clinicId,
                patientId: patient2Id,
                employeeId: doctorId,
                scheduledAt: scheduledTime,
                durationMinutes: 30,
                status: "checked_in",
                appointmentType: "consultation",
            })
            .returning();
        appointment2Id = apt2.id;
        cleanupAppointmentIds.push(apt2.id);

        // Also create clinic visits for the appointments
        await db.insert(clinicVisits).values([
            {
                visitNumber: `VISIT_OV1_${Date.now()}`,
                clinicId,
                patientId: patient1Id,
                appointmentId: appointment1Id,
                doctorId,
                visitorName: "Patient One",
                visitorPhone: "1112223334",
                visitDate: scheduledTime,
                checkInTime: scheduledTime,
                purpose: "consultation",
                status: "in_progress",
            },
            {
                visitNumber: `VISIT_OV2_${Date.now()}`,
                clinicId,
                patientId: patient2Id,
                appointmentId: appointment2Id,
                doctorId,
                visitorName: "Patient Two",
                visitorPhone: "1112223335",
                visitDate: scheduledTime,
                checkInTime: scheduledTime,
                purpose: "consultation",
                status: "checked_in",
            },
        ]);
    });

    afterAll(async () => {
        await db
            .delete(consultations)
            .where(inArray(consultations.patientId, [patient1Id, patient2Id]));
        if (cleanupAppointmentIds.length > 0) {
            await db
                .delete(clinicVisits)
                .where(inArray(clinicVisits.appointmentId, cleanupAppointmentIds));
            await db
                .delete(appointments)
                .where(inArray(appointments.id, cleanupAppointmentIds));
        }
        await db.delete(patients).where(inArray(patients.id, [patient1Id, patient2Id]));
        await db
            .delete(employeeRoleAssignments)
            .where(eq(employeeRoleAssignments.employeeId, doctorId));
        await db.delete(employees).where(eq(employees.id, doctorId));
        await db.delete(clinics).where(eq(clinics.id, clinicId));
    });

    it("allows updating an appointment when the schedule has not changed, even with an overlapping appointment", async () => {
        // Updating symptoms on appointment1 while appointment2 overlaps should NOT throw
        const updated = await updateAppointment(appointment1Id, {
            symptoms: "Tooth pain upper left",
        });
        expect(updated.id).toBe(appointment1Id);
        expect(updated.symptoms).toBe("Tooth pain upper left");
    });

    it("allows saving and updating a consultation when the doctor has an overlapping appointment", async () => {
        // Create consultation for appointment1
        const consult1 = await createConsultation({
            patientId: patient1Id,
            doctorId,
            clinicId,
            appointmentId: appointment1Id,
            chiefComplaint: "Tooth pain upper left",
        });
        cleanupConsultationIds.push(consult1.id);

        await startConsultation(consult1.id);

        // Frontend sends slot date/time + doctorId on every update/complete
        const updated = await updateConsultation(consult1.id, {
            chiefComplaint: "Tooth pain upper left - updated",
            diagnosis: "Irreversible pulpitis #26",
            treatmentPlan: "Root canal therapy",
            clinicalNotes: "Patient tolerated procedure well.",
            appointmentDate: "2026-10-20",
            appointmentTime: "15:30", // or matching wall clock
            doctorId,
        });

        expect(updated.id).toBe(consult1.id);
        expect(updated.diagnosis).toBe("Irreversible pulpitis #26");
    });

    it("allows completing a consultation when the doctor has an overlapping appointment", async () => {
        const [consultRecord] = await db
            .select()
            .from(consultations)
            .where(eq(consultations.appointmentId, appointment1Id));
        expect(consultRecord).toBeDefined();

        // Completing consultation must succeed and mark appointment as completed
        const completed = await completeConsultation(consultRecord.id);
        expect(completed.status).toBe("completed");

        const apt1 = await getAppointmentById(appointment1Id);
        expect(apt1.status).toBe("completed");
    });

    it("allows completing the second consultation after the first completes", async () => {
        // Consultation for second appointment
        const consult2 = await createConsultation({
            patientId: patient2Id,
            doctorId,
            clinicId,
            appointmentId: appointment2Id,
            chiefComplaint: "Cleaning and checkup",
        });
        cleanupConsultationIds.push(consult2.id);

        await startConsultation(consult2.id);

        await updateConsultation(consult2.id, {
            diagnosis: "Gingivitis",
            treatmentPlan: "Scaling and polishing",
            clinicalNotes: "Completed cleaning.",
            appointmentDate: "2026-10-20",
            doctorId,
        });

        const completed2 = await completeConsultation(consult2.id);
        expect(completed2.status).toBe("completed");

        const apt2 = await getAppointmentById(appointment2Id);
        expect(apt2.status).toBe("completed");
    });
});
