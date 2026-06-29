import {
    and,
    count,
    desc,
    eq,
    ilike,
    inArray,
    or,
    SQL,
} from "drizzle-orm";
import { db } from "../../db/client";
import { appointments } from "../../db/schema/appointments";
import { clinics } from "../../db/schema/clinic";
import { consultations } from "../../db/schema/consultations";
import { dentalLabOrderFiles } from "../../db/schema/dentalLabOrderFiles";
import { dentalLabOrders } from "../../db/schema/dentalLabOrders";
import { employeeRoleAssignments } from "../../db/schema/employeeRoleAssignments";
import { employees } from "../../db/schema/employees";
import { files } from "../../db/schema/files";
import { patients } from "../../db/schema/patients";
import { employeeRoles } from "../../db/schema/roles";
import { createAppointment } from "../appointments/appointments.service";
import { ROLE_DOCTOR } from "../auth/auth.constants";
import {
    assertUploadedFileForPatient,
    FileRecord,
    getFileRecord,
} from "../uploads/uploads.service";
import { DentalLabOrderStatus } from "./dentalLab.constants";
import { generateDentalLabOrderCode } from "./dentalLab.utils";

export interface CreateDentalLabOrderInput {
    patientId: string;
    consultationId?: string | null;
    clinicId: string;
    measuredByDoctorId: string;
    labName: string;
    itemType: string;
    toothNumber?: string;
    shade?: string;
    description?: string;
    estimatedDeliveryDate?: Date | string;
    orderedDate?: Date | string;
    notes?: string;
}

export interface ListDentalLabOrdersOptions {
    page?: number;
    limit?: number;
    status?: DentalLabOrderStatus;
    clinicId?: string;
    doctorId?: string;
    patientId?: string;
    search?: string;
}

export interface CreateCementationAppointmentInput {
    employeeId: string;
    scheduledAt?: Date;
    appointmentDate?: string;
    appointmentTime?: string;
    symptoms?: string;
}

export interface RecordCementationInput {
    cementationDoctorId: string;
    cementationDate: Date | string;
    notes?: string;
}

export type DentalLabOrderRow = typeof dentalLabOrders.$inferSelect;
export type DentalLabOrderFileRow = typeof dentalLabOrderFiles.$inferSelect;

type DoctorSummary = {
    id: string;
    name: string;
};

type PatientSummary = {
    id: string;
    patientCode: string;
    name: string;
};

type ClinicSummary = {
    id: string;
    clinicName: string;
};

export type DentalLabOrderDetails = {
    order: DentalLabOrderRow;
    patient: PatientSummary;
    clinic: ClinicSummary;
    measuredDoctor: DoctorSummary;
    cementationDoctor: DoctorSummary | null;
    attachments: FileRecord[];
    appointment: typeof appointments.$inferSelect | null;
};

export type DentalLabOrderPatientSummary = {
    id: string;
    orderCode: string;
    status: DentalLabOrderStatus;
    labName: string;
    itemType: string;
    toothNumber: string | null;
    shade: string | null;
    description: string | null;
    estimatedDeliveryDate: Date | null;
    orderedDate: Date;
    deliveredDate: Date | null;
    cementationDate: Date | null;
    notes: string | null;
    measuredDoctor: DoctorSummary;
    cementationDoctor: DoctorSummary | null;
    attachments: FileRecord[];
    cementationAppointment: typeof appointments.$inferSelect | null;
};

const toDate = (value?: Date | string | null) => {
    if (value === undefined || value === null) {
        return undefined;
    }

    return value instanceof Date ? value : new Date(value);
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
            patientCode: patients.patientCode,
            name: patients.name,
        })
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
            name: employees.name,
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

const assertConsultationForPatient = async (
    consultationId: string,
    patientId: string,
    clinicId: string
) => {
    const [consultation] = await db
        .select()
        .from(consultations)
        .where(eq(consultations.id, consultationId));

    if (!consultation) {
        throw new Error("Consultation not found");
    }

    if (consultation.patientId !== patientId) {
        throw new Error("Consultation does not belong to this patient");
    }

    if (consultation.clinicId !== clinicId) {
        throw new Error("Consultation does not belong to the selected clinic");
    }

    return consultation;
};

const getDoctorSummary = async (
    doctorId: string | null
): Promise<DoctorSummary | null> => {
    if (!doctorId) {
        return null;
    }

    const [doctor] = await db
        .select({ id: employees.id, name: employees.name })
        .from(employees)
        .where(eq(employees.id, doctorId));

    if (!doctor) {
        return null;
    }

    return doctor;
};

const getAttachmentsByOrderIds = async (orderIds: string[]) => {
    const attachmentsByOrderId = new Map<string, FileRecord[]>();

    if (orderIds.length === 0) {
        return attachmentsByOrderId;
    }

    const rows = await db
        .select({
            dentalLabOrderId: dentalLabOrderFiles.dentalLabOrderId,
            file: files,
        })
        .from(dentalLabOrderFiles)
        .innerJoin(files, eq(dentalLabOrderFiles.fileId, files.id))
        .where(inArray(dentalLabOrderFiles.dentalLabOrderId, orderIds))
        .orderBy(desc(dentalLabOrderFiles.createdAt));

    for (const row of rows) {
        const existing = attachmentsByOrderId.get(row.dentalLabOrderId) ?? [];
        existing.push(row.file);
        attachmentsByOrderId.set(row.dentalLabOrderId, existing);
    }

    return attachmentsByOrderId;
};

const getAppointmentsByIds = async (appointmentIds: string[]) => {
    const appointmentById = new Map<
        string,
        typeof appointments.$inferSelect
    >();

    if (appointmentIds.length === 0) {
        return appointmentById;
    }

    const rows = await db
        .select()
        .from(appointments)
        .where(inArray(appointments.id, appointmentIds));

    for (const row of rows) {
        appointmentById.set(row.id, row);
    }

    return appointmentById;
};

export const getDentalLabOrderRecord = async (id: string) => {
    const [order] = await db
        .select()
        .from(dentalLabOrders)
        .where(eq(dentalLabOrders.id, id));

    if (!order) {
        throw new Error("Dental lab order not found");
    }

    return order;
};

const buildOrderDetails = async (
    order: DentalLabOrderRow
): Promise<DentalLabOrderDetails> => {
    const patient = await assertPatientExists(order.patientId);

    const [clinic] = await db
        .select({ id: clinics.id, clinicName: clinics.clinicName })
        .from(clinics)
        .where(eq(clinics.id, order.clinicId));

    if (!clinic) {
        throw new Error("Clinic not found");
    }

    const measuredDoctor = await assertDoctorInClinic(
        order.measuredByDoctorId,
        order.clinicId
    );
    const cementationDoctor = await getDoctorSummary(order.cementationDoctorId);

    const attachmentsByOrderId = await getAttachmentsByOrderIds([order.id]);
    const appointmentById = order.cementationAppointmentId
        ? await getAppointmentsByIds([order.cementationAppointmentId])
        : new Map();

    return {
        order,
        patient: {
            id: patient.id,
            patientCode: patient.patientCode,
            name: patient.name,
        },
        clinic,
        measuredDoctor: {
            id: measuredDoctor.id,
            name: measuredDoctor.name,
        },
        cementationDoctor,
        attachments: attachmentsByOrderId.get(order.id) ?? [],
        appointment: order.cementationAppointmentId
            ? (appointmentById.get(order.cementationAppointmentId) ?? null)
            : null,
    };
};

const toPatientSummary = async (
    order: DentalLabOrderRow,
    attachments: FileRecord[],
    appointment: typeof appointments.$inferSelect | null,
    measuredDoctor: DoctorSummary,
    cementationDoctor: DoctorSummary | null
): Promise<DentalLabOrderPatientSummary> => ({
    id: order.id,
    orderCode: order.orderCode,
    status: order.status,
    labName: order.labName,
    itemType: order.itemType,
    toothNumber: order.toothNumber,
    shade: order.shade,
    description: order.description,
    estimatedDeliveryDate: order.estimatedDeliveryDate,
    orderedDate: order.orderedDate,
    deliveredDate: order.deliveredDate,
    cementationDate: order.cementationDate,
    notes: order.notes,
    measuredDoctor,
    cementationDoctor,
    attachments,
    cementationAppointment: appointment,
});

export const createDentalLabOrder = async (
    input: CreateDentalLabOrderInput
) => {
    await assertClinicExists(input.clinicId);

    const patient = await assertPatientExists(input.patientId);
    if (patient.clinicId !== input.clinicId) {
        throw new Error("Patient does not belong to the selected clinic");
    }

    await assertDoctorInClinic(input.measuredByDoctorId, input.clinicId);

    if (input.consultationId) {
        await assertConsultationForPatient(
            input.consultationId,
            input.patientId,
            input.clinicId
        );
    }

    const now = new Date();
    const orderedDate = toDate(input.orderedDate) ?? now;

    const order = await db.transaction(async (tx) => {
        const orderCode = await generateDentalLabOrderCode(tx);

        const [created] = await tx
            .insert(dentalLabOrders)
            .values({
                orderCode,
                patientId: input.patientId,
                consultationId: input.consultationId ?? null,
                clinicId: input.clinicId,
                measuredByDoctorId: input.measuredByDoctorId,
                labName: input.labName,
                itemType: input.itemType,
                toothNumber: input.toothNumber,
                shade: input.shade,
                description: input.description,
                estimatedDeliveryDate: toDate(input.estimatedDeliveryDate),
                orderedDate,
                status: "ordered",
                notes: input.notes,
                createdAt: now,
                updatedAt: now,
            })
            .returning();

        return created;
    });

    return buildOrderDetails(order);
};

export const listDentalLabOrders = async (
    options: ListDentalLabOrdersOptions
) => {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const offset = (page - 1) * limit;

    const filters: SQL[] = [];

    if (options.clinicId) {
        filters.push(eq(dentalLabOrders.clinicId, options.clinicId));
    }

    if (options.status) {
        filters.push(eq(dentalLabOrders.status, options.status));
    }

    if (options.patientId) {
        filters.push(eq(dentalLabOrders.patientId, options.patientId));
    }

    if (options.doctorId) {
        filters.push(
            or(
                eq(dentalLabOrders.measuredByDoctorId, options.doctorId),
                eq(dentalLabOrders.cementationDoctorId, options.doctorId)
            )!
        );
    }

    if (options.search) {
        const term = `%${options.search}%`;
        filters.push(
            or(
                ilike(dentalLabOrders.orderCode, term),
                ilike(dentalLabOrders.labName, term),
                ilike(dentalLabOrders.itemType, term),
                ilike(dentalLabOrders.toothNumber, term),
                ilike(patients.name, term)
            )!
        );
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const [totalRow] = await db
        .select({ total: count() })
        .from(dentalLabOrders)
        .innerJoin(patients, eq(dentalLabOrders.patientId, patients.id))
        .where(whereClause);

    const rows = await db
        .select({ order: dentalLabOrders })
        .from(dentalLabOrders)
        .innerJoin(patients, eq(dentalLabOrders.patientId, patients.id))
        .where(whereClause)
        .orderBy(desc(dentalLabOrders.createdAt))
        .limit(limit)
        .offset(offset);

    const orderIds = rows.map((row) => row.order.id);
    const appointmentIds = rows
        .map((row) => row.order.cementationAppointmentId)
        .filter((id): id is string => Boolean(id));

    const attachmentsByOrderId = await getAttachmentsByOrderIds(orderIds);
    const appointmentById = await getAppointmentsByIds(appointmentIds);

    const items = await Promise.all(
        rows.map(async (row) => {
            const measuredDoctor = await getDoctorSummary(
                row.order.measuredByDoctorId
            );
            const cementationDoctor = await getDoctorSummary(
                row.order.cementationDoctorId
            );

            return toPatientSummary(
                row.order,
                attachmentsByOrderId.get(row.order.id) ?? [],
                row.order.cementationAppointmentId
                    ? (appointmentById.get(row.order.cementationAppointmentId) ??
                          null)
                    : null,
                measuredDoctor ?? {
                    id: row.order.measuredByDoctorId,
                    name: "",
                },
                cementationDoctor
            );
        })
    );

    return {
        items,
        total: totalRow?.total ?? 0,
        page,
        limit,
    };
};

export const getDentalLabOrderById = async (id: string) => {
    const order = await getDentalLabOrderRecord(id);
    return buildOrderDetails(order);
};

export const deliverDentalLabOrder = async (id: string) => {
    const order = await getDentalLabOrderRecord(id);

    if (order.status !== "ordered") {
        throw new Error("Invalid status transition");
    }

    const now = new Date();

    const [updated] = await db
        .update(dentalLabOrders)
        .set({
            status: "delivered",
            deliveredDate: now,
            updatedAt: now,
        })
        .where(eq(dentalLabOrders.id, id))
        .returning();

    return buildOrderDetails(updated);
};

export const createCementationAppointment = async (
    id: string,
    input: CreateCementationAppointmentInput
) => {
    const order = await getDentalLabOrderRecord(id);

    if (order.status !== "delivered") {
        throw new Error(
            "Cementation appointment can only be created after delivery"
        );
    }

    if (order.cementationAppointmentId) {
        throw new Error("Appointment already exists");
    }

    await assertDoctorInClinic(input.employeeId, order.clinicId);

    const appointment = await createAppointment({
        clinicId: order.clinicId,
        patientId: order.patientId,
        employeeId: input.employeeId,
        scheduledAt: input.scheduledAt,
        appointmentDate: input.appointmentDate,
        appointmentTime: input.appointmentTime,
        symptoms:
            input.symptoms ??
            `Cementation for ${order.itemType} (${order.orderCode})`,
        appointmentType: "treatment",
        dentalLabOrderId: order.id,
    });

    const now = new Date();

    const [updated] = await db
        .update(dentalLabOrders)
        .set({
            cementationAppointmentId: appointment.id,
            updatedAt: now,
        })
        .where(eq(dentalLabOrders.id, id))
        .returning();

    return buildOrderDetails(updated);
};

export const recordCementation = async (
    id: string,
    input: RecordCementationInput
) => {
    const order = await getDentalLabOrderRecord(id);

    if (order.status !== "delivered") {
        throw new Error("Invalid status transition");
    }

    if (order.cementationAppointmentId) {
        const [appointment] = await db
            .select({ id: appointments.id })
            .from(appointments)
            .where(eq(appointments.id, order.cementationAppointmentId));

        if (!appointment) {
            throw new Error("Appointment not found");
        }
    }

    await assertDoctorInClinic(input.cementationDoctorId, order.clinicId);

    const cementationDate = toDate(input.cementationDate);
    if (!cementationDate) {
        throw new Error("cementationDate is required");
    }

    const now = new Date();

    const [updated] = await db
        .update(dentalLabOrders)
        .set({
            cementationDoctorId: input.cementationDoctorId,
            cementationDate,
            status: "cementation_done",
            notes: input.notes ?? order.notes,
            updatedAt: now,
        })
        .where(eq(dentalLabOrders.id, id))
        .returning();

    return buildOrderDetails(updated);
};

export const attachDentalLabFile = async (id: string, fileId: string) => {
    const order = await getDentalLabOrderRecord(id);

    await assertUploadedFileForPatient(fileId, order.patientId);

    const [existingAttachment] = await db
        .select({ id: dentalLabOrderFiles.id })
        .from(dentalLabOrderFiles)
        .where(
            and(
                eq(dentalLabOrderFiles.dentalLabOrderId, id),
                eq(dentalLabOrderFiles.fileId, fileId)
            )
        );

    if (existingAttachment) {
        throw new Error("Duplicate attachment");
    }

    await getFileRecord(fileId);

    await db.insert(dentalLabOrderFiles).values({
        dentalLabOrderId: id,
        fileId,
    });

    const updatedOrder = await getDentalLabOrderRecord(id);
    return buildOrderDetails(updatedOrder);
};

export const removeDentalLabFile = async (id: string, fileId: string) => {
    const order = await getDentalLabOrderRecord(id);

    const [attachment] = await db
        .select()
        .from(dentalLabOrderFiles)
        .where(
            and(
                eq(dentalLabOrderFiles.dentalLabOrderId, id),
                eq(dentalLabOrderFiles.fileId, fileId)
            )
        );

    if (!attachment) {
        throw new Error("File not found");
    }

    await db
        .delete(dentalLabOrderFiles)
        .where(eq(dentalLabOrderFiles.id, attachment.id));

    return buildOrderDetails(order);
};

export const listDentalLabOrdersByPatientId = async (patientId: string) => {
    await assertPatientExists(patientId);

    const orderRows = await db
        .select()
        .from(dentalLabOrders)
        .where(eq(dentalLabOrders.patientId, patientId))
        .orderBy(desc(dentalLabOrders.createdAt));

    const orderIds = orderRows.map((row) => row.id);
    const appointmentIds = orderRows
        .map((row) => row.cementationAppointmentId)
        .filter((appointmentId): appointmentId is string =>
            Boolean(appointmentId)
        );

    const attachmentsByOrderId = await getAttachmentsByOrderIds(orderIds);
    const appointmentById = await getAppointmentsByIds(appointmentIds);

    return Promise.all(
        orderRows.map(async (order) => {
            const measuredDoctor = await getDoctorSummary(
                order.measuredByDoctorId
            );
            const cementationDoctor = await getDoctorSummary(
                order.cementationDoctorId
            );

            return toPatientSummary(
                order,
                attachmentsByOrderId.get(order.id) ?? [],
                order.cementationAppointmentId
                    ? (appointmentById.get(order.cementationAppointmentId) ??
                          null)
                    : null,
                measuredDoctor ?? {
                    id: order.measuredByDoctorId,
                    name: "",
                },
                cementationDoctor
            );
        })
    );
};

export type DentalLabTimelineEvent = {
    type: string;
    date: string;
};

export const getDentalLabTimelineEventsForPatient = async (
    patientId: string
) => {
    const orderRows = await db
        .select()
        .from(dentalLabOrders)
        .where(eq(dentalLabOrders.patientId, patientId));

    const orderIds = orderRows.map((row) => row.id);
    const appointmentIds = orderRows
        .map((row) => row.cementationAppointmentId)
        .filter((id): id is string => Boolean(id));
    const appointmentById = await getAppointmentsByIds(appointmentIds);

    const junctionRows =
        orderIds.length > 0
            ? await db
                  .select()
                  .from(dentalLabOrderFiles)
                  .where(inArray(dentalLabOrderFiles.dentalLabOrderId, orderIds))
            : [];

    const events: DentalLabTimelineEvent[] = [];

    for (const order of orderRows) {
        events.push({
            type: "dental_lab_order_created",
            date: order.createdAt.toISOString(),
        });

        for (const junction of junctionRows.filter(
            (row) => row.dentalLabOrderId === order.id
        )) {
            events.push({
                type: "dental_lab_file_attached",
                date: junction.createdAt.toISOString(),
            });
        }

        if (order.deliveredDate) {
            events.push({
                type: "dental_lab_delivered",
                date: order.deliveredDate.toISOString(),
            });
        }

        if (order.cementationAppointmentId) {
            const appointment = appointmentById.get(
                order.cementationAppointmentId
            );
            if (appointment) {
                events.push({
                    type: "cementation_appointment_created",
                    date: appointment.createdAt.toISOString(),
                });
            }
        }

        if (order.cementationDate) {
            events.push({
                type: "cementation_completed",
                date: order.cementationDate.toISOString(),
            });
        }
    }

    return events;
};
