import {
    and,
    count,
    desc,
    eq,
    ilike,
    inArray,
    or,
} from "drizzle-orm";
import { db } from "../../db/client";
import { appointments } from "../../db/schema/appointments";
import { clinics } from "../../db/schema/clinic";
import { employeeRoleAssignments } from "../../db/schema/employeeRoleAssignments";
import { employees } from "../../db/schema/employees";
import { leads } from "../../db/schema/leads";
import { patients } from "../../db/schema/patients";
import { employeeRoles } from "../../db/schema/roles";
import { ROLE_DOCTOR } from "../auth/auth.constants";
import {
    AppointmentStatus,
    LeadSource,
    LeadStatus,
    PUBLIC_INTAKE_DEFAULT_NOTES,
} from "./leads.constants";
import { generateAppointmentCode } from "../appointments/appointments.utils";
import {
    buildPaginationMeta,
    buildScheduledAt,
    getPagination,
} from "./leads.utils";

export interface CreateLeadInput {
    clinicId: string;
    patientId?: string;
    name: string;
    email?: string;
    phone: string;
    source: LeadSource;
    symptoms?: string;
    notes?: string;
}

export interface CreatePublicLeadInput {
    clinicId: string;
    name: string;
    email?: string;
    phone: string;
    symptoms?: string;
}

export interface ListLeadsOptions {
    page?: number;
    limit?: number;
    clinicId?: string;
    status?: LeadStatus;
    search?: string;
}

export interface UpdateLeadInput {
    name?: string;
    email?: string | null;
    phone?: string;
    source?: LeadSource;
    symptoms?: string | null;
    notes?: string | null;
    clinicId?: string;
    patientId?: string | null;
}

export interface BookLeadAppointmentInput {
    clinicId: string;
    scheduledAt?: Date;
    appointmentDate?: string;
    appointmentTime?: string;
    employeeId?: string;
    symptoms?: string;
}

type AppointmentSummary = {
    id: string;
    scheduledAt: Date;
    status: AppointmentStatus;
    employeeId: string | null;
    employeeName: string | null;
    clinicId: string;
    symptoms: string | null;
};

export type LeadWithDetails = {
    id: string;
    clinicId: string;
    clinicName: string;
    patientId: string | null;
    name: string;
    email: string | null;
    phone: string;
    source: LeadSource;
    status: LeadStatus;
    symptoms: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    appointment: AppointmentSummary | null;
};

const assertClinicExists = async (clinicId: string) => {
    const [clinic] = await db
        .select({ id: clinics.id })
        .from(clinics)
        .where(eq(clinics.id, clinicId));

    if (!clinic) {
        throw new Error("Clinic not found");
    }
};

const assertPatientExists = async (patientId: string) => {
    const [patient] = await db
        .select({ id: patients.id })
        .from(patients)
        .where(eq(patients.id, patientId));

    if (!patient) {
        throw new Error("Patient not found");
    }
};

const assertEmployeeIsDoctorInClinic = async (
    employeeId: string,
    clinicId: string
) => {
    const [employee] = await db
        .select({
            id: employees.id,
            clinicId: employees.clinicId,
            name: employees.name,
            roleName: employeeRoles.name,
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
                eq(employees.id, employeeId),
                eq(employeeRoles.name, ROLE_DOCTOR),
                eq(employees.isActive, true)
            )
        );

    if (!employee) {
        throw new Error("Employee not found");
    }

    if (employee.clinicId !== clinicId) {
        throw new Error("Employee does not belong to the selected clinic");
    }

    return employee;
};

const getLeadRecord = async (id: string) => {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));

    if (!lead) {
        throw new Error("Lead not found");
    }

    return lead;
};

const fetchLatestAppointmentsByLeadIds = async (leadIds: string[]) => {
    const appointmentMap = new Map<string, AppointmentSummary>();

    if (leadIds.length === 0) {
        return appointmentMap;
    }

    const rows = await db
        .select({
            id: appointments.id,
            leadId: appointments.leadId,
            scheduledAt: appointments.scheduledAt,
            status: appointments.status,
            employeeId: appointments.employeeId,
            employeeName: employees.name,
            clinicId: appointments.clinicId,
            symptoms: appointments.symptoms,
        })
        .from(appointments)
        .leftJoin(employees, eq(appointments.employeeId, employees.id))
        .where(inArray(appointments.leadId, leadIds))
        .orderBy(desc(appointments.scheduledAt));

    for (const row of rows) {
        if (!row.leadId || appointmentMap.has(row.leadId)) {
            continue;
        }

        appointmentMap.set(row.leadId, {
            id: row.id,
            scheduledAt: row.scheduledAt,
            status: row.status ?? "scheduled",
            employeeId: row.employeeId,
            employeeName: row.employeeName,
            clinicId: row.clinicId,
            symptoms: row.symptoms,
        });
    }

    return appointmentMap;
};

const enrichLeads = async (
    leadRows: (typeof leads.$inferSelect)[]
): Promise<LeadWithDetails[]> => {
    if (leadRows.length === 0) {
        return [];
    }

    const clinicIds = [...new Set(leadRows.map((lead) => lead.clinicId))];
    const clinicRows = await db
        .select({
            id: clinics.id,
            clinicName: clinics.clinicName,
        })
        .from(clinics)
        .where(inArray(clinics.id, clinicIds));

    const clinicNameById = new Map(
        clinicRows.map((clinic) => [clinic.id, clinic.clinicName])
    );

    const appointmentMap = await fetchLatestAppointmentsByLeadIds(
        leadRows.map((lead) => lead.id)
    );

    return leadRows.map((lead) => ({
        id: lead.id,
        clinicId: lead.clinicId,
        clinicName: clinicNameById.get(lead.clinicId) ?? "",
        patientId: lead.patientId,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        source: lead.source,
        status: lead.status,
        symptoms: lead.symptoms,
        notes: lead.notes,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
        appointment: appointmentMap.get(lead.id) ?? null,
    }));
};

const syncAppointmentStatusForLeadStatus = async (
    leadId: string,
    status: LeadStatus
) => {
    const appointmentStatusByLeadStatus: Partial<
        Record<LeadStatus, AppointmentStatus>
    > = {
        clinic_visited: "completed",
        no_show: "no_show",
    };

    const appointmentStatus = appointmentStatusByLeadStatus[status];
    if (!appointmentStatus) {
        return;
    }

    await db
        .update(appointments)
        .set({
            status: appointmentStatus,
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(appointments.leadId, leadId),
                eq(appointments.status, "scheduled")
            )
        );
};

export const createLead = async (input: CreateLeadInput) => {
    await assertClinicExists(input.clinicId);

    if (input.patientId) {
        await assertPatientExists(input.patientId);
    }

    const [lead] = await db
        .insert(leads)
        .values({
            clinicId: input.clinicId,
            patientId: input.patientId,
            name: input.name,
            email: input.email,
            phone: input.phone,
            source: input.source,
            status: "new_query",
            symptoms: input.symptoms,
            notes: input.notes,
        })
        .returning();

    const [enriched] = await enrichLeads([lead]);
    return enriched;
};

export const createPublicLead = async (input: CreatePublicLeadInput) => {
    return createLead({
        ...input,
        source: "qr_self",
        notes: PUBLIC_INTAKE_DEFAULT_NOTES,
    });
};

export const listLeads = async (options: ListLeadsOptions) => {
    const { page, limit, offset } = getPagination(
        options.page,
        options.limit
    );

    const filters = [];

    if (options.clinicId) {
        filters.push(eq(leads.clinicId, options.clinicId));
    }

    if (options.status) {
        filters.push(eq(leads.status, options.status));
    }

    if (options.search) {
        const term = `%${options.search}%`;
        filters.push(or(ilike(leads.name, term), ilike(leads.phone, term))!);
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const [totalRow] = await db
        .select({ total: count() })
        .from(leads)
        .where(whereClause);

    const leadRows = await db
        .select()
        .from(leads)
        .where(whereClause)
        .orderBy(desc(leads.createdAt))
        .limit(limit)
        .offset(offset);

    const items = await enrichLeads(leadRows);

    return {
        items,
        pagination: buildPaginationMeta(page, limit, totalRow?.total ?? 0),
    };
};

export const getLeadById = async (id: string) => {
    const lead = await getLeadRecord(id);
    const [enriched] = await enrichLeads([lead]);
    return enriched;
};

export const updateLeadStatus = async (id: string, status: LeadStatus) => {
    if (status === "appointment_booked") {
        throw new Error(
            "Use the book-appointment endpoint to move a lead to appointment_booked"
        );
    }

    const lead = await getLeadRecord(id);

    const [updated] = await db
        .update(leads)
        .set({
            status,
            updatedAt: new Date(),
        })
        .where(eq(leads.id, lead.id))
        .returning();

    await syncAppointmentStatusForLeadStatus(updated.id, status);

    const [enriched] = await enrichLeads([updated]);
    return enriched;
};

export const updateLead = async (id: string, input: UpdateLeadInput) => {
    const lead = await getLeadRecord(id);

    if (input.clinicId) {
        await assertClinicExists(input.clinicId);
    }

    if (input.patientId) {
        await assertPatientExists(input.patientId);
    }

    const [updated] = await db
        .update(leads)
        .set({
            ...input,
            updatedAt: new Date(),
        })
        .where(eq(leads.id, lead.id))
        .returning();

    const [enriched] = await enrichLeads([updated]);
    return enriched;
};

export const bookLeadAppointment = async (
    id: string,
    input: BookLeadAppointmentInput
) => {
    const lead = await getLeadRecord(id);
    await assertClinicExists(input.clinicId);

    if (input.employeeId) {
        await assertEmployeeIsDoctorInClinic(
            input.employeeId,
            input.clinicId
        );
    }

    const scheduledAt = buildScheduledAt(
        input.scheduledAt,
        input.appointmentDate,
        input.appointmentTime
    );

    const result = await db.transaction(async (tx) => {
        const [existingAppointment] = await tx
            .select({ id: appointments.id })
            .from(appointments)
            .where(
                and(
                    eq(appointments.leadId, lead.id),
                    eq(appointments.status, "scheduled")
                )
            )
            .orderBy(desc(appointments.scheduledAt))
            .limit(1);

        let appointmentId: string;

        if (existingAppointment) {
            const [appointment] = await tx
                .update(appointments)
                .set({
                    clinicId: input.clinicId,
                    employeeId: input.employeeId,
                    patientId: lead.patientId,
                    scheduledAt,
                    symptoms: input.symptoms ?? lead.symptoms,
                    status: "scheduled",
                    updatedAt: new Date(),
                })
                .where(eq(appointments.id, existingAppointment.id))
                .returning();

            appointmentId = appointment.id;
        } else {
            const appointmentCode = await generateAppointmentCode(tx);
            const [appointment] = await tx
                .insert(appointments)
                .values({
                    appointmentCode,
                    clinicId: input.clinicId,
                    employeeId: input.employeeId,
                    patientId: lead.patientId,
                    leadId: lead.id,
                    scheduledAt,
                    symptoms: input.symptoms ?? lead.symptoms,
                    status: "scheduled",
                })
                .returning();

            appointmentId = appointment.id;
        }

        const [updatedLead] = await tx
            .update(leads)
            .set({
                clinicId: input.clinicId,
                status: "appointment_booked",
                symptoms: input.symptoms ?? lead.symptoms,
                updatedAt: new Date(),
            })
            .where(eq(leads.id, lead.id))
            .returning();

        return { lead: updatedLead, appointmentId };
    });

    const [enriched] = await enrichLeads([result.lead]);
    return enriched;
};

export const convertLeadToPatient = async (
    id: string,
    patientId?: string
) => {
    const lead = await getLeadRecord(id);

    if (lead.patientId) {
        const [enriched] = await enrichLeads([lead]);
        return enriched;
    }

    let resolvedPatientId = patientId;

    if (!resolvedPatientId) {
        const [matchedPatient] = await db
            .select({ id: patients.id })
            .from(patients)
            .where(
                and(
                    eq(patients.phone, lead.phone),
                    eq(patients.clinicId, lead.clinicId)
                )
            )
            .limit(1);

        resolvedPatientId = matchedPatient?.id;
    }

    if (!resolvedPatientId) {
        throw new Error(
            "Patient not found. Register the patient first or provide patientId"
        );
    }

    await assertPatientExists(resolvedPatientId);

    const [updated] = await db
        .update(leads)
        .set({
            patientId: resolvedPatientId,
            updatedAt: new Date(),
        })
        .where(eq(leads.id, lead.id))
        .returning();

    await db
        .update(appointments)
        .set({
            patientId: resolvedPatientId,
            updatedAt: new Date(),
        })
        .where(eq(appointments.leadId, lead.id));

    const [enriched] = await enrichLeads([updated]);
    return enriched;
};

export const assertLeadClinicAccess = (
    leadClinicId: string,
    hasPlatformAccess: boolean,
    requesterClinicId?: string | null
) => {
    if (hasPlatformAccess) {
        return;
    }

    if (!requesterClinicId || leadClinicId !== requesterClinicId) {
        throw new Error("You cannot access leads from another clinic");
    }
};
