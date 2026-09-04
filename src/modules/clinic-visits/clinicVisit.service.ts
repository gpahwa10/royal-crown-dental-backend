import {
    and,
    count,
    desc,
    eq,
    gte,
    ilike,
    inArray,
    isNotNull,
    lte,
    or,
    SQL,
    sql,
} from "drizzle-orm";
import { db } from "../../db/client";
import { appointments } from "../../db/schema/appointments";
import { clinicVisitFiles } from "../../db/schema/clinicVisitFiles";
import { clinicVisits } from "../../db/schema/clinicVisits";
import { clinics } from "../../db/schema/clinic";
import { consultations } from "../../db/schema/consultations";
import { employeeRoleAssignments } from "../../db/schema/employeeRoleAssignments";
import { employees } from "../../db/schema/employees";
import { files } from "../../db/schema/files";
import { invoices } from "../../db/schema/invoices";
import { leads } from "../../db/schema/leads";
import { patientMemberships } from "../../db/schema/patientMemberships";
import { patients } from "../../db/schema/patients";
import { employeeRoles } from "../../db/schema/roles";
import { ROLE_DOCTOR } from "../auth/auth.constants";
import { PaymentMethod } from "../billing/billing.constants";
import { createAppointment } from "../appointments/appointments.service";
import {
    createConsultation,
    startConsultation,
} from "../consultations/consultations.service";
import {
    completeMembershipPayment,
    purchasePatientMembership,
} from "../membership/membership.service";
import {
    RegisterPatientInput,
    registerPatient,
} from "../patients/patients.service";
import {
    assertUploadedFileForPatient,
    buildStoredFileUrl,
} from "../uploads/uploads.service";
import {
    ACTIVE_CLINIC_VISIT_STATUSES,
    ClinicVisitOutcome,
    ClinicVisitPurpose,
    ClinicVisitStatus,
} from "./clinicVisit.constants";
import {
    generateVisitNumber,
    getPagination,
} from "./clinicVisit.utils";
import {
    clinicCalendarDayEnd,
    clinicCalendarDayStart,
    endOfZonedDay,
    startOfZonedDay,
} from "../scheduling/scheduling.utils";
import { CLINIC_TIMEZONE } from "../scheduling/scheduling.constants";

export type ClinicVisitRow = typeof clinicVisits.$inferSelect;

export interface CreateClinicVisitInput {
    clinicId: string;
    visitorName: string;
    visitorPhone: string;
    visitorEmail?: string;
    patientId?: string;
    leadId?: string;
    appointmentId?: string;
    doctorId?: string;
    purpose: ClinicVisitPurpose;
    notes?: string;
    visitDate?: Date;
    createdBy?: string;
}

export interface UpdateClinicVisitInput {
    purpose?: ClinicVisitPurpose;
    doctorId?: string | null;
    outcome?: ClinicVisitOutcome | null;
    notes?: string | null;
    treatmentPerformed?: string | null;
}

export interface ListClinicVisitsOptions {
    page?: number;
    limit?: number;
    clinicId?: string;
    doctorId?: string;
    patientId?: string;
    purpose?: ClinicVisitPurpose;
    outcome?: ClinicVisitOutcome;
    status?: ClinicVisitStatus;
    isRegistered?: boolean;
    treatmentPerformed?: boolean;
    search?: string;
    dateFrom?: Date;
    dateTo?: Date;
}

export type ClinicVisitPatientSummary = {
    id: string;
    visitNumber: string;
    purpose: ClinicVisitPurpose;
    outcome: ClinicVisitOutcome | null;
    status: ClinicVisitStatus;
    visitDate: string;
    checkInTime: string;
    checkOutTime: string | null;
    doctor: { id: string | null; name: string | null };
    appointment: { id: string; scheduledAt: string } | null;
    consultation: { id: string; status: string } | null;
    invoice: { id: string; invoiceNumber: string; status: string } | null;
    membership: { id: string; status: string } | null;
    treatmentPerformed: string | null;
    notes: string | null;
};

export type ClinicVisitDetails = {
    visit: ClinicVisitRow;
    clinic: { id: string; clinicName: string };
    patient: { id: string; name: string; patientCode: string } | null;
    lead: { id: string; name: string; phone: string } | null;
    doctor: { id: string; name: string } | null;
    appointment: (typeof appointments.$inferSelect) | null;
    consultation: (typeof consultations.$inferSelect) | null;
    invoice: (typeof invoices.$inferSelect) | null;
    membership: (typeof patientMemberships.$inferSelect) | null;
    medicalRecords: Array<{
        id: string;
        fileId: string;
        fileName: string;
        fileUrl: string;
        contentType: string;
        createdAt: string;
    }>;
};

export {
    buildClinicVisitTimelineEvents,
    getClinicVisitDashboardMetrics,
    getClinicVisitTimelineEventsForPatient,
} from "./clinicVisit.metrics";

const assertClinicExists = async (clinicId: string) => {
    const [clinic] = await db
        .select({ id: clinics.id, clinicName: clinics.clinicName })
        .from(clinics)
        .where(eq(clinics.id, clinicId));

    if (!clinic) {
        throw new Error("Clinic not found");
    }

    return clinic;
};

const assertPatientExists = async (patientId: string) => {
    const [patient] = await db
        .select({
            id: patients.id,
            clinicId: patients.clinicId,
            name: patients.name,
            phone: patients.phone,
            email: patients.email,
            patientCode: patients.patientCode,
        })
        .from(patients)
        .where(eq(patients.id, patientId));

    if (!patient) {
        throw new Error("Patient not found");
    }

    return patient;
};

const assertLeadExists = async (leadId: string, clinicId: string) => {
    const [lead] = await db
        .select()
        .from(leads)
        .where(eq(leads.id, leadId));

    if (!lead) {
        throw new Error("Lead not found");
    }

    if (lead.clinicId !== clinicId) {
        throw new Error("Lead does not belong to the selected clinic");
    }

    return lead;
};

const assertDoctorInClinic = async (doctorId: string, clinicId: string) => {
    const [doctor] = await db
        .select({ id: employees.id, name: employees.name })
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
                eq(employees.clinicId, clinicId),
                eq(employees.isActive, true)
            )
        );

    if (!doctor) {
        throw new Error("Doctor not found");
    }

    return doctor;
};

const assertAppointmentForVisit = async (
    appointmentId: string,
    clinicId: string,
    patientId?: string | null
) => {
    const [appointment] = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, appointmentId));

    if (!appointment) {
        throw new Error("Appointment not found");
    }

    if (appointment.clinicId !== clinicId) {
        throw new Error("Appointment does not belong to the selected clinic");
    }

    if (
        patientId &&
        appointment.patientId &&
        appointment.patientId !== patientId
    ) {
        throw new Error("Appointment does not belong to this patient");
    }

    return appointment;
};

export const getClinicVisitRecord = async (id: string) => {
    const [visit] = await db
        .select()
        .from(clinicVisits)
        .where(eq(clinicVisits.id, id));

    if (!visit) {
        throw new Error("Clinic visit not found");
    }

    return visit;
};

const assertVisitIsOpen = (visit: ClinicVisitRow) => {
    if (visit.status === "completed") {
        throw new Error("Visit is already completed");
    }

    if (visit.status === "cancelled") {
        throw new Error("Visit is cancelled");
    }

    if (visit.checkOutTime) {
        throw new Error("Already checked out");
    }
};

const assertNoDuplicateCheckIn = async (
    clinicId: string,
    visitorPhone: string,
    visitDate: Date
) => {
    const [existing] = await db
        .select({ id: clinicVisits.id })
        .from(clinicVisits)
        .where(
            and(
                eq(clinicVisits.clinicId, clinicId),
                eq(clinicVisits.visitorPhone, visitorPhone),
                inArray(clinicVisits.status, [...ACTIVE_CLINIC_VISIT_STATUSES]),
                gte(clinicVisits.visitDate, startOfZonedDay(CLINIC_TIMEZONE, visitDate)),
                lte(clinicVisits.visitDate, endOfZonedDay(CLINIC_TIMEZONE, visitDate))
            )
        )
        .limit(1);

    if (existing) {
        throw new Error("Duplicate check-in");
    }
};

const getMedicalRecordsForVisit = async (visitId: string) => {
    const rows = await db
        .select({
            id: clinicVisitFiles.id,
            fileId: clinicVisitFiles.fileId,
            createdAt: clinicVisitFiles.createdAt,
            file: files,
        })
        .from(clinicVisitFiles)
        .innerJoin(files, eq(clinicVisitFiles.fileId, files.id))
        .where(eq(clinicVisitFiles.clinicVisitId, visitId))
        .orderBy(desc(clinicVisitFiles.createdAt));

    return rows.map((row) => ({
        id: row.id,
        fileId: row.fileId,
        fileName: row.file.originalFileName,
        fileUrl: buildStoredFileUrl(row.file),
        contentType: row.file.contentType,
        createdAt: row.createdAt.toISOString(),
    }));
};

export const buildClinicVisitDetails = async (
    visit: ClinicVisitRow
): Promise<ClinicVisitDetails> => {
    const clinic = await assertClinicExists(visit.clinicId);

    const patient = visit.patientId
        ? await assertPatientExists(visit.patientId)
        : null;

    const [lead] = visit.leadId
        ? await db.select().from(leads).where(eq(leads.id, visit.leadId))
        : [null];

    const [doctor] = visit.doctorId
        ? await db
              .select({ id: employees.id, name: employees.name })
              .from(employees)
              .where(eq(employees.id, visit.doctorId))
        : [null];

    const [appointment] = visit.appointmentId
        ? await db
              .select()
              .from(appointments)
              .where(eq(appointments.id, visit.appointmentId))
        : [null];

    const [consultation] = visit.consultationId
        ? await db
              .select()
              .from(consultations)
              .where(eq(consultations.id, visit.consultationId))
        : [null];

    const [invoice] = visit.invoiceId
        ? await db
              .select()
              .from(invoices)
              .where(eq(invoices.id, visit.invoiceId))
        : [null];

    const [membership] = visit.membershipId
        ? await db
              .select()
              .from(patientMemberships)
              .where(eq(patientMemberships.id, visit.membershipId))
        : [null];

    return {
        visit,
        clinic: { id: clinic.id, clinicName: clinic.clinicName },
        patient: patient
            ? {
                  id: patient.id,
                  name: patient.name,
                  patientCode: patient.patientCode,
              }
            : null,
        lead: lead
            ? { id: lead.id, name: lead.name, phone: lead.phone }
            : null,
        doctor,
        appointment: appointment ?? null,
        consultation: consultation ?? null,
        invoice: invoice ?? null,
        membership: membership ?? null,
        medicalRecords: await getMedicalRecordsForVisit(visit.id),
    };
};

export const createClinicVisit = async (input: CreateClinicVisitInput) => {
    await assertClinicExists(input.clinicId);

    const now = new Date();
    const visitDate = input.visitDate ?? now;

    if (input.patientId) {
        const patient = await assertPatientExists(input.patientId);
        if (patient.clinicId !== input.clinicId) {
            throw new Error("Patient does not belong to the selected clinic");
        }
    }

    if (input.leadId) {
        await assertLeadExists(input.leadId, input.clinicId);
    }

    if (input.doctorId) {
        await assertDoctorInClinic(input.doctorId, input.clinicId);
    }

    let appointmentId = input.appointmentId;
    if (appointmentId) {
        await assertAppointmentForVisit(
            appointmentId,
            input.clinicId,
            input.patientId
        );
    }

    await assertNoDuplicateCheckIn(
        input.clinicId,
        input.visitorPhone,
        visitDate
    );

    const visit = await db.transaction(async (tx) => {
        const visitNumber = await generateVisitNumber(tx);

        const [created] = await tx
            .insert(clinicVisits)
            .values({
                visitNumber,
                clinicId: input.clinicId,
                patientId: input.patientId ?? null,
                leadId: input.leadId ?? null,
                appointmentId: appointmentId ?? null,
                visitorName: input.visitorName,
                visitorPhone: input.visitorPhone,
                visitorEmail: input.visitorEmail ?? null,
                doctorId: input.doctorId ?? null,
                visitDate,
                checkInTime: now,
                purpose: input.purpose,
                status: "checked_in",
                isRegistered: Boolean(input.patientId),
                notes: input.notes ?? null,
                createdBy: input.createdBy ?? null,
                createdAt: now,
                updatedAt: now,
            })
            .returning();

        if (appointmentId) {
            await tx
                .update(appointments)
                .set({
                    status: "checked_in",
                    checkedInAt: now,
                    updatedAt: now,
                })
                .where(eq(appointments.id, appointmentId));
        }

        return created;
    });

    return buildClinicVisitDetails(visit);
};

export const listClinicVisits = async (options: ListClinicVisitsOptions) => {
    const { page, limit, offset } = getPagination(options.page, options.limit);
    const filters: SQL[] = [];

    if (options.clinicId) filters.push(eq(clinicVisits.clinicId, options.clinicId));
    if (options.doctorId) filters.push(eq(clinicVisits.doctorId, options.doctorId));
    if (options.patientId) filters.push(eq(clinicVisits.patientId, options.patientId));
    if (options.purpose) filters.push(eq(clinicVisits.purpose, options.purpose));
    if (options.outcome) filters.push(eq(clinicVisits.outcome, options.outcome));
    if (options.status) filters.push(eq(clinicVisits.status, options.status));
    if (options.isRegistered !== undefined) {
        filters.push(eq(clinicVisits.isRegistered, options.isRegistered));
    }
    if (options.treatmentPerformed === true) {
        filters.push(isNotNull(clinicVisits.treatmentPerformed));
    }
    if (options.treatmentPerformed === false) {
        filters.push(sql`${clinicVisits.treatmentPerformed} IS NULL`);
    }
    if (options.dateFrom) {
        filters.push(gte(clinicVisits.visitDate, clinicCalendarDayStart(options.dateFrom)));
    }
    if (options.dateTo) {
        filters.push(lte(clinicVisits.visitDate, clinicCalendarDayEnd(options.dateTo)));
    }
    if (options.search) {
        const term = `%${options.search}%`;
        filters.push(
            or(
                ilike(clinicVisits.visitNumber, term),
                ilike(clinicVisits.visitorName, term),
                ilike(clinicVisits.visitorPhone, term),
                ilike(clinicVisits.visitorEmail, term)
            )!
        );
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const [totalRow] = await db
        .select({ total: count() })
        .from(clinicVisits)
        .where(whereClause);

    const items = await db
        .select()
        .from(clinicVisits)
        .where(whereClause)
        .orderBy(desc(clinicVisits.checkInTime))
        .limit(limit)
        .offset(offset);

    const details = await Promise.all(
        items.map((visit) => buildClinicVisitDetails(visit))
    );

    return { items: details, total: totalRow?.total ?? 0, page, limit };
};

export const getClinicVisitById = async (id: string) => {
    const visit = await getClinicVisitRecord(id);
    return buildClinicVisitDetails(visit);
};

export const updateClinicVisit = async (
    id: string,
    input: UpdateClinicVisitInput
) => {
    const visit = await getClinicVisitRecord(id);
    assertVisitIsOpen(visit);

    if (input.doctorId) {
        await assertDoctorInClinic(input.doctorId, visit.clinicId);
    }

    const [updated] = await db
        .update(clinicVisits)
        .set({
            ...(input.purpose !== undefined && { purpose: input.purpose }),
            ...(input.doctorId !== undefined && { doctorId: input.doctorId }),
            ...(input.outcome !== undefined && { outcome: input.outcome }),
            ...(input.notes !== undefined && { notes: input.notes }),
            ...(input.treatmentPerformed !== undefined && {
                treatmentPerformed: input.treatmentPerformed,
            }),
            updatedAt: new Date(),
        })
        .where(eq(clinicVisits.id, id))
        .returning();

    return buildClinicVisitDetails(updated);
};

export const checkOutClinicVisit = async (id: string) => {
    const visit = await getClinicVisitRecord(id);

    if (visit.status === "completed") {
        throw new Error("Visit is already completed");
    }

    if (visit.status === "cancelled") {
        throw new Error("Visit is cancelled");
    }

    const now = new Date();

    const [updated] = await db
        .update(clinicVisits)
        .set({
            checkOutTime: now,
            status: "completed",
            updatedAt: now,
        })
        .where(eq(clinicVisits.id, id))
        .returning();

    return buildClinicVisitDetails(updated);
};

export const registerPatientFromVisit = async (
    id: string,
    input: RegisterPatientInput
) => {
    const visit = await getClinicVisitRecord(id);
    assertVisitIsOpen(visit);

    if (visit.isRegistered && visit.patientId) {
        throw new Error("Patient already registered for this visit");
    }

    const registration = await registerPatient({
        ...input,
        clinicId: visit.clinicId,
        name: input.name ?? visit.visitorName,
        phone: input.phone ?? visit.visitorPhone,
        email: input.email ?? visit.visitorEmail ?? undefined,
    });

    const [updated] = await db
        .update(clinicVisits)
        .set({
            patientId: registration.patient.id,
            isRegistered: true,
            outcome: "patient_registered",
            status: visit.status === "checked_in" ? "in_progress" : visit.status,
            updatedAt: new Date(),
        })
        .where(eq(clinicVisits.id, id))
        .returning();

    if (visit.leadId) {
        await db
            .update(leads)
            .set({
                patientId: registration.patient.id,
                status: "converted",
                updatedAt: new Date(),
            })
            .where(eq(leads.id, visit.leadId));
    }

    return {
        visit: await buildClinicVisitDetails(updated),
        patient: registration,
    };
};

export const startConsultationFromVisit = async (
    id: string,
    input: {
        doctorId?: string;
        chiefComplaint: string;
        appointmentId?: string;
    }
) => {
    const visit = await getClinicVisitRecord(id);
    assertVisitIsOpen(visit);

    if (!visit.patientId) {
        throw new Error("Patient must be registered before starting consultation");
    }

    const doctorId = input.doctorId ?? visit.doctorId;
    if (!doctorId) {
        throw new Error("Doctor is required to start consultation");
    }

    const appointmentId = input.appointmentId ?? visit.appointmentId ?? undefined;

    const consultation = await createConsultation({
        patientId: visit.patientId,
        doctorId,
        clinicId: visit.clinicId,
        appointmentId,
        chiefComplaint: input.chiefComplaint,
    });

    const startedConsultation = await startConsultation(consultation.id);

    const [updated] = await db
        .update(clinicVisits)
        .set({
            consultationId: startedConsultation.id,
            doctorId,
            appointmentId: appointmentId ?? visit.appointmentId,
            status: "in_progress",
            updatedAt: new Date(),
        })
        .where(eq(clinicVisits.id, id))
        .returning();

    return {
        visit: await buildClinicVisitDetails(updated),
        consultation: startedConsultation,
    };
};

export const createAppointmentFromVisit = async (
    id: string,
    input: {
        employeeId?: string;
        scheduledAt?: Date;
        appointmentDate?: string;
        appointmentTime?: string;
        symptoms?: string;
    }
) => {
    const visit = await getClinicVisitRecord(id);
    assertVisitIsOpen(visit);

    const appointment = await createAppointment({
        clinicId: visit.clinicId,
        patientId: visit.patientId ?? undefined,
        leadId: visit.leadId ?? undefined,
        employeeId: input.employeeId ?? visit.doctorId ?? undefined,
        scheduledAt: input.scheduledAt,
        appointmentDate: input.appointmentDate,
        appointmentTime: input.appointmentTime,
        symptoms: input.symptoms,
    });

    const [updated] = await db
        .update(clinicVisits)
        .set({
            appointmentId: appointment.id,
            outcome: "appointment_booked",
            status: visit.status === "checked_in" ? "in_progress" : visit.status,
            updatedAt: new Date(),
        })
        .where(eq(clinicVisits.id, id))
        .returning();

    return {
        visit: await buildClinicVisitDetails(updated),
        appointment,
    };
};

export const createMembershipFromVisit = async (
    id: string,
    input: {
        membershipPlanId: string;
        payment?: {
            amount: number;
            paymentMethod: PaymentMethod;
            paymentReference?: string;
            paymentDate?: Date;
            notes?: string;
        };
        purchasedBy?: string;
        receivedBy?: string;
    }
) => {
    const visit = await getClinicVisitRecord(id);
    assertVisitIsOpen(visit);

    if (!visit.patientId) {
        throw new Error("Patient must be registered before purchasing membership");
    }

    const purchase = await purchasePatientMembership({
        patientId: visit.patientId,
        membershipPlanId: input.membershipPlanId,
        purchasedBy: input.purchasedBy,
    });

    let membershipResult: Awaited<ReturnType<typeof purchasePatientMembership>> =
        purchase;
    let activated = false;

    if (input.payment) {
        const paymentResult = await completeMembershipPayment(
            purchase.membership.id,
            {
                ...input.payment,
                receivedBy: input.receivedBy,
            }
        );
        membershipResult = {
            ...purchase,
            membership: paymentResult.membership,
            invoice: paymentResult.invoice,
        };
        activated = paymentResult.activated ?? false;
    }

    const [updated] = await db
        .update(clinicVisits)
        .set({
            membershipId: purchase.membership.id,
            invoiceId: purchase.invoice.invoice.id,
            outcome: activated ? "membership_purchased" : visit.outcome,
            status: visit.status === "checked_in" ? "in_progress" : visit.status,
            updatedAt: new Date(),
        })
        .where(eq(clinicVisits.id, id))
        .returning();

    return {
        visit: await buildClinicVisitDetails(updated),
        membership: membershipResult,
        activated,
    };
};

export const attachMedicalRecordToVisit = async (
    id: string,
    fileId: string
) => {
    const visit = await getClinicVisitRecord(id);
    assertVisitIsOpen(visit);

    if (!visit.patientId) {
        throw new Error("Patient must be registered before attaching medical records");
    }

    await assertUploadedFileForPatient(
        fileId,
        visit.patientId,
        "patient_document"
    );

    const [existing] = await db
        .select({ id: clinicVisitFiles.id })
        .from(clinicVisitFiles)
        .where(
            and(
                eq(clinicVisitFiles.clinicVisitId, id),
                eq(clinicVisitFiles.fileId, fileId)
            )
        );

    if (!existing) {
        await db.insert(clinicVisitFiles).values({
            clinicVisitId: id,
            fileId,
        });
    }

    const [updated] = await db
        .update(clinicVisits)
        .set({
            outcome: visit.outcome ?? "reports_collected",
            updatedAt: new Date(),
        })
        .where(eq(clinicVisits.id, id))
        .returning();

    return buildClinicVisitDetails(updated);
};

const toPatientSummary = async (
    visit: ClinicVisitRow
): Promise<ClinicVisitPatientSummary> => {
    const details = await buildClinicVisitDetails(visit);

    return {
        id: visit.id,
        visitNumber: visit.visitNumber,
        purpose: visit.purpose,
        outcome: visit.outcome,
        status: visit.status,
        visitDate: visit.visitDate.toISOString(),
        checkInTime: visit.checkInTime.toISOString(),
        checkOutTime: visit.checkOutTime?.toISOString() ?? null,
        doctor: details.doctor
            ? { id: details.doctor.id, name: details.doctor.name }
            : { id: null, name: null },
        appointment: details.appointment
            ? {
                  id: details.appointment.id,
                  scheduledAt: details.appointment.scheduledAt.toISOString(),
              }
            : null,
        consultation: details.consultation
            ? {
                  id: details.consultation.id,
                  status: details.consultation.status,
              }
            : null,
        invoice: details.invoice
            ? {
                  id: details.invoice.id,
                  invoiceNumber: details.invoice.invoiceNumber,
                  status: details.invoice.status,
              }
            : null,
        membership: details.membership
            ? {
                  id: details.membership.id,
                  status: details.membership.status,
              }
            : null,
        treatmentPerformed: visit.treatmentPerformed,
        notes: visit.notes,
    };
};

export const listClinicVisitsByPatientId = async (patientId: string) => {
    const [patient] = await db
        .select({ id: patients.id })
        .from(patients)
        .where(eq(patients.id, patientId));

    if (!patient) {
        throw new Error("Patient not found");
    }

    const rows = await db
        .select()
        .from(clinicVisits)
        .where(eq(clinicVisits.patientId, patientId))
        .orderBy(desc(clinicVisits.checkInTime));

    return Promise.all(rows.map((row) => toPatientSummary(row)));
};

export const linkInvoiceToClinicVisit = async (
    visitId: string,
    invoiceId: string
) => {
    const visit = await getClinicVisitRecord(visitId);

    const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoiceId));

    if (!invoice) {
        throw new Error("Invoice not found");
    }

    const [updated] = await db
        .update(clinicVisits)
        .set({
            invoiceId,
            outcome: "billing_completed",
            updatedAt: new Date(),
        })
        .where(eq(clinicVisits.id, visit.id))
        .returning();

    return buildClinicVisitDetails(updated);
};
