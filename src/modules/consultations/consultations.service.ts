import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db/client";
import { appointments } from "../../db/schema/appointments";
import { clinics } from "../../db/schema/clinic";
import { clinicVisits } from "../../db/schema/clinicVisits";
import { consultations } from "../../db/schema/consultations";
import { consultationOdontograms } from "../../db/schema/consultationOdontograms";
import { employeeRoleAssignments } from "../../db/schema/employeeRoleAssignments";
import { employees } from "../../db/schema/employees";
import { patients } from "../../db/schema/patients";
import { employeeRoles } from "../../db/schema/roles";
import { ROLE_DOCTOR } from "../auth/auth.constants";
import {
    getPrescriptionsForConsultation,
    getPrescriptionsForConsultationIds,
} from "../prescriptions/prescriptions.service";
import {
    finalizeConsultationOdontogram,
    getConsultationOdontogram,
} from "../odontograms/odontograms.service";
import { generateConsultationCode } from "./consultations.utils";

export interface CreateConsultationInput {
    patientId: string;
    doctorId: string;
    clinicId: string;
    appointmentId?: string;
    chiefComplaint: string;
}

export interface UpdateConsultationInput {
    chiefComplaint?: string;
    diagnosis?: string | null;
    treatmentPlan?: string | null;
    clinicalNotes?: string | null;
    nextVisitDate?: Date | string | null;
    consentRequired?: boolean;
    consentSigned?: boolean;
    consentSignatureUrl?: string | null;
}

const assertClinicExists = async (clinicId: string) => {
    const [clinic] = await db
        .select({ id: clinics.id, isActive: clinics.isActive })
        .from(clinics)
        .where(eq(clinics.id, clinicId));

    if (!clinic) {
        throw new Error("Clinic not found");
    }

    if (!clinic.isActive) {
        throw new Error("Clinic is not active");
    }
};

const assertPatientExists = async (patientId: string) => {
    const [patient] = await db
        .select({ id: patients.id, clinicId: patients.clinicId })
        .from(patients)
        .where(eq(patients.id, patientId));

    if (!patient) {
        throw new Error("Patient not found");
    }

    return patient;
};

const assertDoctorInClinic = async (doctorId: string, clinicId: string) => {
    const [doctor] = await db
        .select({
            id: employees.id,
            clinicId: employees.clinicId,
        })
        .from(employees)
        .innerJoin(
            employeeRoleAssignments,
            eq(employeeRoleAssignments.employeeId, employees.id)
        )
        .innerJoin(
            employeeRoles,
            eq(employeeRoleAssignments.roleId, employeeRoles.id)
        )
        .where(
            and(
                eq(employees.id, doctorId),
                eq(employeeRoles.name, ROLE_DOCTOR),
                eq(employees.isActive, true)
            )
        );

    if (!doctor) {
        throw new Error("Doctor not found");
    }

    if (doctor.clinicId !== clinicId) {
        throw new Error("Doctor does not belong to the selected clinic");
    }

    return doctor;
};

const assertAppointmentForPatient = async (
    appointmentId: string,
    patientId: string,
    clinicId: string
) => {
    const [appointment] = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, appointmentId));

    if (!appointment) {
        throw new Error("Appointment not found");
    }

    if (!appointment.patientId) {
        throw new Error(
            "Appointment must be linked to a registered patient before starting a consultation"
        );
    }

    if (appointment.patientId !== patientId) {
        throw new Error("Appointment does not belong to this patient");
    }

    if (appointment.clinicId !== clinicId) {
        throw new Error("Appointment does not belong to the selected clinic");
    }

    return appointment;
};

export const getConsultationRecord = async (id: string) => {
    const [consultation] = await db
        .select()
        .from(consultations)
        .where(eq(consultations.id, id));

    if (!consultation) {
        throw new Error("Consultation not found");
    }

    return consultation;
};

export const createConsultation = async (input: CreateConsultationInput) => {
    const [patient] = await Promise.all([
        assertPatientExists(input.patientId),
        assertClinicExists(input.clinicId),
        assertDoctorInClinic(input.doctorId, input.clinicId),
        input.appointmentId
            ? assertAppointmentForPatient(
                  input.appointmentId,
                  input.patientId,
                  input.clinicId
              )
            : Promise.resolve(null),
    ]);

    if (patient.clinicId !== input.clinicId) {
        throw new Error("Patient does not belong to the selected clinic");
    }

    const [consultation] = await db.transaction(async (tx) => {
        const consultationCode = await generateConsultationCode(tx);

        const [created] = await tx
            .insert(consultations)
            .values({
                consultationCode,
                clinicId: input.clinicId,
                patientId: input.patientId,
                doctorId: input.doctorId,
                appointmentId: input.appointmentId,
                chiefComplaint: input.chiefComplaint,
                status: "draft",
            })
            .returning();

        return [created];
    });

    return consultation;
};

export const getConsultationById = async (id: string) => {
    const consultation = await getConsultationRecord(id);
    const prescriptions = await getPrescriptionsForConsultation(id);
    const odontogram = await getConsultationOdontogram(id);

    return {
        consultation,
        odontogram,
        prescriptions,
    };
};

export const updateConsultation = async (
    id: string,
    input: UpdateConsultationInput
) => {
    const consultation = await getConsultationRecord(id);

    if (consultation.status === "cancelled") {
        throw new Error("Cannot update a cancelled consultation");
    }

    const consentSignedAt =
        input.consentSigned === true
            ? consultation.consentSignedAt ?? new Date()
            : input.consentSigned === false
              ? null
              : undefined;

    const [updated] = await db
        .update(consultations)
        .set({
            ...(input.chiefComplaint !== undefined && {
                chiefComplaint: input.chiefComplaint,
            }),
            ...(input.diagnosis !== undefined && {
                diagnosis: input.diagnosis,
            }),
            ...(input.treatmentPlan !== undefined && {
                treatmentPlan: input.treatmentPlan,
            }),
            ...(input.clinicalNotes !== undefined && {
                clinicalNotes: input.clinicalNotes,
            }),
            ...(input.nextVisitDate !== undefined && {
                nextVisitDate:
                    input.nextVisitDate === null
                        ? null
                        : new Date(input.nextVisitDate),
            }),
            ...(input.consentRequired !== undefined && {
                consentRequired: input.consentRequired,
            }),
            ...(input.consentSigned !== undefined && {
                consentSigned: input.consentSigned,
            }),
            ...(consentSignedAt !== undefined && { consentSignedAt }),
            ...(input.consentSignatureUrl !== undefined && {
                consentSignatureUrl: input.consentSignatureUrl,
            }),
            updatedAt: new Date(),
        })
        .where(eq(consultations.id, consultation.id))
        .returning();

    return updated;
};

export const startConsultation = async (id: string) => {
    const consultation = await getConsultationRecord(id);

    if (consultation.status === "cancelled") {
        throw new Error("Cannot start a cancelled consultation");
    }

    if (consultation.status === "in_progress" || consultation.status === "completed") {
        return consultation;
    }

    if (consultation.status !== "draft") {
        throw new Error("Only draft consultations can be started");
    }

    const [updated] = await db
        .update(consultations)
        .set({
            status: "in_progress",
            updatedAt: new Date(),
        })
        .where(eq(consultations.id, consultation.id))
        .returning();

    return updated;
};

export const completeConsultation = async (id: string) => {
    return await db.transaction(async (tx) => {
        const [consultation] = await tx
            .select()
            .from(consultations)
            .where(eq(consultations.id, id));

        if (!consultation) {
            throw new Error("Consultation not found");
        }

        if (consultation.status !== "in_progress") {
            throw new Error("Only in-progress consultations can be completed");
        }

        if (!consultation.diagnosis?.trim()) {
            throw new Error("Diagnosis is required before completing consultation");
        }

        if (consultation.consentRequired && !consultation.consentSigned) {
            throw new Error("Consent required before completion");
        }

        await finalizeConsultationOdontogram(
            tx,
            consultation.id,
            consultation.clinicId
        );

        const [updated] = await tx
            .update(consultations)
            .set({
                status: "completed",
                updatedAt: new Date(),
            })
            .where(eq(consultations.id, consultation.id))
            .returning();

        await tx
            .update(clinicVisits)
            .set({
                outcome: "consultation_completed",
                updatedAt: new Date(),
            })
            .where(eq(clinicVisits.consultationId, consultation.id));

        return updated;
    });
};

export const listConsultationsByPatientId = async (patientId: string) => {
    await assertPatientExists(patientId);

    const rows = await db
        .select({
            consultation: consultations,
            doctorName: employees.name,
            doctorDesignation: employees.designation,
        })
        .from(consultations)
        .leftJoin(employees, eq(consultations.doctorId, employees.id))
        .where(eq(consultations.patientId, patientId))
        .orderBy(desc(consultations.createdAt));

    if (rows.length === 0) {
        return [];
    }

    const consultationIds = rows.map((r) => r.consultation.id);

    const [odontogramRows, prescriptionsByConsultationId] = await Promise.all([
        db
            .select()
            .from(consultationOdontograms)
            .where(inArray(consultationOdontograms.consultationId, consultationIds)),
        getPrescriptionsForConsultationIds(consultationIds),
    ]);

    const odontogramByConsultationId = new Map(
        odontogramRows.map((o) => [
            o.consultationId,
            {
                consultationId: o.consultationId,
                patientId: o.patientId,
                clinicId: o.clinicId,
                statusChart: o.statusChart,
                planChart: o.planChart ?? {},
                chartVersion: o.chartVersion,
                readOnly: false,
                updatedAt: o.updatedAt,
            },
        ])
    );

    return rows.map(({ consultation, doctorName, doctorDesignation }) => ({
        ...consultation,
        doctorName,
        doctorDesignation,
        doctor: {
            id: consultation.doctorId,
            name: doctorName,
            designation: doctorDesignation,
        },
        odontogram: odontogramByConsultationId.get(consultation.id) ?? null,
        prescriptions: prescriptionsByConsultationId.get(consultation.id) ?? [],
    }));
};

export { assertConsultationClinicAccess } from "./consultations.utils";
