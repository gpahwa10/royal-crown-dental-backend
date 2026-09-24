import {
    and,
    count,
    desc,
    eq,
    gte,
    ilike,
    inArray,
    lte,
    or,
} from "drizzle-orm";
import { db } from "../../db/client";
import { appointments } from "../../db/schema/appointments";
import { clinics } from "../../db/schema/clinic";
import { clinicVisits } from "../../db/schema/clinicVisits";
import { consultations } from "../../db/schema/consultations";
import { dentalLabOrders } from "../../db/schema/dentalLabOrders";
import { employeeRoleAssignments } from "../../db/schema/employeeRoleAssignments";
import { employees } from "../../db/schema/employees";
import { leads } from "../../db/schema/leads";
import { patients } from "../../db/schema/patients";
import { employeeRoles } from "../../db/schema/roles";
import { ROLE_DOCTOR } from "../auth/auth.constants";
import {
    ACTIVE_CLINIC_VISIT_STATUSES,
    ClinicVisitPurpose,
} from "../clinic-visits/clinicVisit.constants";
import { generateVisitNumber } from "../clinic-visits/clinicVisit.utils";
import { AppointmentStatus, AppointmentType } from "./appointments.constants";
import {
    buildPaginationMeta,
    buildScheduledAt,
    generateAppointmentCode,
    getPagination,
} from "./appointments.utils";
import {
    CLINIC_TIMEZONE,
    DEFAULT_APPOINTMENT_DURATION_MINUTES,
} from "../scheduling/scheduling.constants";
import {
    clinicCalendarDayEnd,
    clinicCalendarDayStart,
    endOfZonedDay,
    startOfZonedDay,
} from "../scheduling/scheduling.utils";
import {
    assertAppointmentScheduleValid,
    listAvailableDoctors,
} from "../scheduling/scheduling.service";

export interface CreateAppointmentInput {
    clinicId: string;
    patientId?: string;
    leadId?: string;
    employeeId?: string;
    scheduledAt?: Date;
    appointmentDate?: string;
    appointmentTime?: string;
    symptoms?: string;
    appointmentType?: AppointmentType;
    dentalLabOrderId?: string;
}

export interface CreateWalkInAppointmentInput {
    clinicId: string;
    patientId?: string;
    leadId?: string;
    employeeId?: string;
    symptoms?: string;
    purpose?: ClinicVisitPurpose;
    notes?: string;
    createdBy?: string;
}

export interface ListAppointmentsOptions {
    page?: number;
    limit?: number;
    clinicId?: string;
    status?: AppointmentStatus;
    employeeId?: string;
    patientId?: string;
    leadId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    search?: string;
}

export interface UpdateAppointmentInput {
    clinicId?: string;
    employeeId?: string | null;
    patientId?: string | null;
    leadId?: string | null;
    scheduledAt?: Date;
    appointmentDate?: string;
    appointmentTime?: string;
    symptoms?: string | null;
}

export type AppointmentWithDetails = {
    id: string;
    clinicId: string;
    clinicName: string;
    employeeId: string | null;
    employeeName: string | null;
    patientId: string | null;
    patientName: string | null;
    leadId: string | null;
    leadName: string | null;
    appointmentType: AppointmentType;
    scheduledAt: Date;
    status: AppointmentStatus;
    checkedInAt: Date | null;
    symptoms: string | null;
    createdAt: Date;
    updatedAt: Date;
};

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
        .select({
            id: patients.id,
            clinicId: patients.clinicId,
            name: patients.name,
            phone: patients.phone,
            email: patients.email,
        })
        .from(patients)
        .where(eq(patients.id, patientId));

    if (!patient) {
        throw new Error("Patient not found");
    }

    return patient;
};

const assertLeadExists = async (leadId: string) => {
    const [lead] = await db
        .select()
        .from(leads)
        .where(eq(leads.id, leadId));

    if (!lead) {
        throw new Error("Lead not found");
    }

    return lead;
};

const assertEmployeeIsDoctorInClinic = async (
    employeeId: string,
    clinicId: string
) => {
    const [employee] = await db
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
};

const getAppointmentRecord = async (id: string) => {
    const [appointment] = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, id));

    if (!appointment) {
        throw new Error("Appointment not found");
    }

    return appointment;
};

const enrichAppointments = async (
    appointmentRows: (typeof appointments.$inferSelect)[]
): Promise<AppointmentWithDetails[]> => {
    if (appointmentRows.length === 0) {
        return [];
    }

    const clinicIds = [
        ...new Set(appointmentRows.map((row) => row.clinicId)),
    ];
    const employeeIds = [
        ...new Set(
            appointmentRows
                .map((row) => row.employeeId)
                .filter((id): id is string => Boolean(id))
        ),
    ];
    const patientIds = [
        ...new Set(
            appointmentRows
                .map((row) => row.patientId)
                .filter((id): id is string => Boolean(id))
        ),
    ];
    const leadIds = [
        ...new Set(
            appointmentRows
                .map((row) => row.leadId)
                .filter((id): id is string => Boolean(id))
        ),
    ];

    const clinicRows =
        clinicIds.length > 0
            ? await db
                  .select({
                      id: clinics.id,
                      clinicName: clinics.clinicName,
                  })
                  .from(clinics)
                  .where(inArray(clinics.id, clinicIds))
            : [];

    const employeeRows =
        employeeIds.length > 0
            ? await db
                  .select({ id: employees.id, name: employees.name })
                  .from(employees)
                  .where(inArray(employees.id, employeeIds))
            : [];

    const patientRows =
        patientIds.length > 0
            ? await db
                  .select({ id: patients.id, name: patients.name })
                  .from(patients)
                  .where(inArray(patients.id, patientIds))
            : [];

    const leadRows =
        leadIds.length > 0
            ? await db
                  .select({ id: leads.id, name: leads.name })
                  .from(leads)
                  .where(inArray(leads.id, leadIds))
            : [];

    const clinicNameById = new Map(
        clinicRows.map((row) => [row.id, row.clinicName])
    );
    const employeeNameById = new Map(
        employeeRows.map((row) => [row.id, row.name])
    );
    const patientNameById = new Map(
        patientRows.map((row) => [row.id, row.name])
    );
    const leadNameById = new Map(leadRows.map((row) => [row.id, row.name]));

    return appointmentRows.map((row) => ({
        id: row.id,
        clinicId: row.clinicId,
        clinicName: clinicNameById.get(row.clinicId) ?? "",
        employeeId: row.employeeId,
        employeeName: row.employeeId
            ? (employeeNameById.get(row.employeeId) ?? null)
            : null,
        patientId: row.patientId,
        patientName: row.patientId
            ? (patientNameById.get(row.patientId) ?? null)
            : null,
        leadId: row.leadId,
        leadName: row.leadId ? (leadNameById.get(row.leadId) ?? null) : null,
        appointmentType: row.appointmentType,
        scheduledAt: row.scheduledAt,
        status: row.status ?? "scheduled",
        checkedInAt: row.checkedInAt,
        symptoms: row.symptoms,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    }));
};

const syncLeadStatusForAppointmentStatus = async (
    leadId: string | null,
    status: AppointmentStatus
) => {
    if (!leadId) {
        return;
    }

    const leadStatusByAppointmentStatus: Partial<
        Record<AppointmentStatus, (typeof leads.$inferSelect)["status"]>
    > = {
        completed: "clinic_visited",
        no_show: "no_show",
        scheduled: "appointment_booked",
    };

    const leadStatus = leadStatusByAppointmentStatus[status];
    if (!leadStatus) {
        return;
    }

    await db
        .update(leads)
        .set({
            status: leadStatus,
            updatedAt: new Date(),
        })
        .where(eq(leads.id, leadId));
};

const resolveCreateContext = async (input: CreateAppointmentInput) => {
    await assertClinicExists(input.clinicId);

    let patientId = input.patientId;
    let leadRecord: typeof leads.$inferSelect | undefined;

    if (input.leadId) {
        leadRecord = await assertLeadExists(input.leadId);
        patientId = patientId ?? leadRecord.patientId ?? undefined;
    }

    if (patientId) {
        const patient = await assertPatientExists(patientId);
        if (patient.clinicId !== input.clinicId) {
            throw new Error("Patient does not belong to the selected clinic");
        }
    }

    if (input.employeeId) {
        await assertEmployeeIsDoctorInClinic(
            input.employeeId,
            input.clinicId
        );
    }

    return { patientId, leadRecord };
};

export const createAppointment = async (input: CreateAppointmentInput) => {
    const { patientId, leadRecord } = await resolveCreateContext(input);

    const scheduledAt = buildScheduledAt(
        input.scheduledAt,
        input.appointmentDate,
        input.appointmentTime
    );

    const durationMinutes = DEFAULT_APPOINTMENT_DURATION_MINUTES;

    await assertAppointmentScheduleValid({
        clinicId: input.clinicId,
        employeeId: input.employeeId,
        scheduledAt,
        durationMinutes,
    });

    const [appointment] = await db.transaction(async (tx) => {
        const appointmentCode = await generateAppointmentCode(tx);
        const [created] = await tx
            .insert(appointments)
            .values({
                appointmentCode,
                clinicId: input.clinicId,
                patientId,
                leadId: input.leadId,
                employeeId: input.employeeId,
                scheduledAt,
                durationMinutes,
                symptoms: input.symptoms ?? leadRecord?.symptoms ?? undefined,
                status: "scheduled",
                appointmentType: input.appointmentType ?? "general",
                dentalLabOrderId: input.dentalLabOrderId,
            })
            .returning();

        if (input.leadId) {
            await tx
                .update(leads)
                .set({
                    status: "appointment_booked",
                    clinicId: input.clinicId,
                    patientId: patientId ?? leadRecord?.patientId,
                    symptoms: input.symptoms ?? leadRecord?.symptoms,
                    updatedAt: new Date(),
                })
                .where(eq(leads.id, input.leadId));
        }

        return [created];
    });

    const [enriched] = await enrichAppointments([appointment]);
    return enriched;
};

const assertNoActiveWalkInCheckIn = async (
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
                gte(
                    clinicVisits.visitDate,
                    startOfZonedDay(CLINIC_TIMEZONE, visitDate)
                ),
                lte(
                    clinicVisits.visitDate,
                    endOfZonedDay(CLINIC_TIMEZONE, visitDate)
                )
            )
        )
        .limit(1);

    if (existing) {
        throw new Error("Duplicate check-in");
    }
};

export const createWalkInAppointment = async (
    input: CreateWalkInAppointmentInput
) => {
    const { patientId, leadRecord } = await resolveCreateContext(input);
    const now = new Date();

    const patient = patientId ? await assertPatientExists(patientId) : null;
    const visitorName = patient?.name ?? leadRecord?.name;
    const visitorPhone = patient?.phone ?? leadRecord?.phone;
    const visitorEmail = patient?.email ?? leadRecord?.email ?? undefined;

    if (!visitorName || !visitorPhone) {
        throw new Error("Visitor name and phone are required for walk-in");
    }

    await assertNoActiveWalkInCheckIn(input.clinicId, visitorPhone, now);

    const result = await db.transaction(async (tx) => {
        const appointmentCode = await generateAppointmentCode(tx);
        const [appointment] = await tx
            .insert(appointments)
            .values({
                appointmentCode,
                clinicId: input.clinicId,
                patientId,
                leadId: input.leadId,
                employeeId: input.employeeId,
                scheduledAt: now,
                durationMinutes: DEFAULT_APPOINTMENT_DURATION_MINUTES,
                symptoms: input.symptoms ?? leadRecord?.symptoms ?? undefined,
                status: "checked_in",
                checkedInAt: now,
                appointmentType: "walk_in",
            })
            .returning();

        const visitNumber = await generateVisitNumber(tx);
        const [visit] = await tx
            .insert(clinicVisits)
            .values({
                visitNumber,
                clinicId: input.clinicId,
                patientId: patientId ?? null,
                leadId: input.leadId ?? null,
                appointmentId: appointment.id,
                visitorName,
                visitorPhone,
                visitorEmail: visitorEmail ?? null,
                doctorId: input.employeeId ?? null,
                visitDate: now,
                checkInTime: now,
                purpose: input.purpose ?? "consultation",
                status: "checked_in",
                isRegistered: Boolean(patientId),
                notes: input.notes ?? input.symptoms ?? null,
                createdBy: input.createdBy ?? null,
                createdAt: now,
                updatedAt: now,
            })
            .returning();

        if (input.leadId) {
            await tx
                .update(leads)
                .set({
                    status: "appointment_booked",
                    clinicId: input.clinicId,
                    patientId: patientId ?? leadRecord?.patientId,
                    symptoms: input.symptoms ?? leadRecord?.symptoms,
                    updatedAt: now,
                })
                .where(eq(leads.id, input.leadId));
        }

        return { appointment, visit };
    });

    const [enriched] = await enrichAppointments([result.appointment]);
    return {
        appointment: enriched,
        visit: {
            id: result.visit.id,
            visitNumber: result.visit.visitNumber,
            status: result.visit.status,
            purpose: result.visit.purpose,
            visitDate: result.visit.visitDate,
            checkInTime: result.visit.checkInTime,
            patientId: result.visit.patientId,
            appointmentId: result.visit.appointmentId,
            doctorId: result.visit.doctorId,
        },
    };
};

export const listAppointments = async (options: ListAppointmentsOptions) => {
    const { page, limit, offset } = getPagination(
        options.page,
        options.limit
    );

    const filters = [];

    if (options.clinicId) {
        filters.push(eq(appointments.clinicId, options.clinicId));
    }

    if (options.status) {
        filters.push(eq(appointments.status, options.status));
    }

    if (options.employeeId) {
        filters.push(eq(appointments.employeeId, options.employeeId));
    }

    if (options.patientId) {
        filters.push(eq(appointments.patientId, options.patientId));
    }

    if (options.leadId) {
        filters.push(eq(appointments.leadId, options.leadId));
    }

    if (options.dateFrom) {
        filters.push(
            gte(appointments.scheduledAt, clinicCalendarDayStart(options.dateFrom))
        );
    }

    if (options.dateTo) {
        filters.push(
            lte(appointments.scheduledAt, clinicCalendarDayEnd(options.dateTo))
        );
    }

    if (options.search) {
        const term = `%${options.search}%`;
        const matchingPatients = await db
            .select({ id: patients.id })
            .from(patients)
            .where(
                or(ilike(patients.name, term), ilike(patients.phone, term))!
            );
        const matchingLeads = await db
            .select({ id: leads.id })
            .from(leads)
            .where(or(ilike(leads.name, term), ilike(leads.phone, term))!);

        const patientIds = matchingPatients.map((row) => row.id);
        const leadIds = matchingLeads.map((row) => row.id);

        const searchFilters = [];
        if (patientIds.length > 0) {
            searchFilters.push(inArray(appointments.patientId, patientIds));
        }
        if (leadIds.length > 0) {
            searchFilters.push(inArray(appointments.leadId, leadIds));
        }

        if (searchFilters.length === 0) {
            return {
                items: [],
                pagination: buildPaginationMeta(page, limit, 0),
            };
        }

        filters.push(or(...searchFilters)!);
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const [totalRow] = await db
        .select({ total: count() })
        .from(appointments)
        .where(whereClause);

    const appointmentRows = await db
        .select()
        .from(appointments)
        .where(whereClause)
        .orderBy(desc(appointments.scheduledAt))
        .limit(limit)
        .offset(offset);

    const items = await enrichAppointments(appointmentRows);

    return {
        items,
        pagination: buildPaginationMeta(page, limit, totalRow?.total ?? 0),
    };
};

export const getAppointmentById = async (id: string) => {
    const appointment = await getAppointmentRecord(id);
    const [enriched] = await enrichAppointments([appointment]);
    return enriched;
};

export const updateAppointment = async (
    id: string,
    input: UpdateAppointmentInput
) => {
    const appointment = await getAppointmentRecord(id);
    const clinicId = input.clinicId ?? appointment.clinicId;

    if (input.clinicId) {
        await assertClinicExists(input.clinicId);
    }

    if (input.patientId) {
        const patient = await assertPatientExists(input.patientId);
        if (patient.clinicId !== clinicId) {
            throw new Error("Patient does not belong to the selected clinic");
        }
    }

    if (input.leadId) {
        await assertLeadExists(input.leadId);
    }

    if (input.employeeId) {
        await assertEmployeeIsDoctorInClinic(input.employeeId, clinicId);
    }

    const hasScheduleInput =
        input.scheduledAt !== undefined ||
        input.appointmentDate !== undefined ||
        input.appointmentTime !== undefined;

    const scheduledAt = hasScheduleInput
        ? buildScheduledAt(
              input.scheduledAt,
              input.appointmentDate,
              input.appointmentTime
          )
        : undefined;

    const nextEmployeeId =
        input.employeeId !== undefined
            ? input.employeeId
            : appointment.employeeId;
    const nextScheduledAt = scheduledAt ?? appointment.scheduledAt;
    const durationMinutes =
        appointment.durationMinutes ?? DEFAULT_APPOINTMENT_DURATION_MINUTES;

    if (
        hasScheduleInput ||
        input.employeeId !== undefined ||
        input.clinicId !== undefined
    ) {
        await assertAppointmentScheduleValid({
            clinicId,
            employeeId: nextEmployeeId,
            scheduledAt: nextScheduledAt,
            durationMinutes,
            excludeAppointmentId: appointment.id,
        });
    }

    const [updated] = await db
        .update(appointments)
        .set({
            ...(input.clinicId !== undefined && { clinicId: input.clinicId }),
            ...(input.employeeId !== undefined && {
                employeeId: input.employeeId,
            }),
            ...(input.patientId !== undefined && {
                patientId: input.patientId,
            }),
            ...(input.leadId !== undefined && { leadId: input.leadId }),
            ...(input.symptoms !== undefined && { symptoms: input.symptoms }),
            ...(scheduledAt !== undefined && { scheduledAt }),
            updatedAt: new Date(),
        })
        .where(eq(appointments.id, appointment.id))
        .returning();

    const [enriched] = await enrichAppointments([updated]);
    return enriched;
};

export const getAvailableDoctorsForSlot = listAvailableDoctors;

export const updateAppointmentStatus = async (
    id: string,
    status: AppointmentStatus
) => {
    const appointment = await getAppointmentRecord(id);

    const [updated] = await db
        .update(appointments)
        .set({
            status,
            updatedAt: new Date(),
        })
        .where(eq(appointments.id, appointment.id))
        .returning();

    await syncLeadStatusForAppointmentStatus(updated.leadId, status);

    const [enriched] = await enrichAppointments([updated]);
    return enriched;
};

export const assertAppointmentClinicAccess = (
    appointmentClinicId: string,
    _hasPlatformAccess: boolean,
    requesterClinicId?: string | null
) => {
    if (
        !requesterClinicId ||
        appointmentClinicId !== requesterClinicId
    ) {
        throw new Error("You cannot access appointments from another clinic");
    }
};

export const assertAppointmentShiftAccess = (
    sourceClinicId: string,
    targetClinicId: string,
    _hasPlatformAccess: boolean,
    requesterClinicId?: string | null
) => {
    if (
        !requesterClinicId ||
        sourceClinicId !== requesterClinicId ||
        targetClinicId !== requesterClinicId
    ) {
        throw new Error("You cannot shift appointments to another clinic");
    }
};

export const shiftAppointmentClinic = async (
    id: string,
    newClinicId: string
) => {
    const appointment = await getAppointmentRecord(id);

    if (appointment.status !== "scheduled") {
        throw new Error(
            "Only scheduled appointments can be shifted to another clinic"
        );
    }

    if (appointment.clinicId === newClinicId) {
        throw new Error("Appointment is already at the requested clinic");
    }

    await assertClinicExists(newClinicId);

    const [updated] = await db.transaction(async (tx) => {
        const [shifted] = await tx
            .update(appointments)
            .set({
                clinicId: newClinicId,
                employeeId: null,
                updatedAt: new Date(),
            })
            .where(eq(appointments.id, appointment.id))
            .returning();

        if (shifted.leadId) {
            await tx
                .update(leads)
                .set({
                    clinicId: newClinicId,
                    updatedAt: new Date(),
                })
                .where(eq(leads.id, shifted.leadId));
        }

        return [shifted];
    });

    const [enriched] = await enrichAppointments([updated]);
    return enriched;
};

export const deleteAppointment = async (id: string) => {
    const appointment = await getAppointmentRecord(id);

    await db.transaction(async (tx) => {
        await tx
            .update(consultations)
            .set({ appointmentId: null, updatedAt: new Date() })
            .where(eq(consultations.appointmentId, appointment.id));
        await tx
            .update(clinicVisits)
            .set({ appointmentId: null, updatedAt: new Date() })
            .where(eq(clinicVisits.appointmentId, appointment.id));
        await tx
            .update(dentalLabOrders)
            .set({ cementationAppointmentId: null, updatedAt: new Date() })
            .where(eq(dentalLabOrders.cementationAppointmentId, appointment.id));
        await tx.delete(appointments).where(eq(appointments.id, appointment.id));
    });

    return { id: appointment.id };
};
