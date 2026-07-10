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
import { clinics } from "../../db/schema/clinic";
import { consultations } from "../../db/schema/consultations";
import { employeeRoleAssignments } from "../../db/schema/employeeRoleAssignments";
import { employees } from "../../db/schema/employees";
import { labReports } from "../../db/schema/labReports";
import { labRequests } from "../../db/schema/labRequests";
import { labRequestTests } from "../../db/schema/labRequestsTests";
import { patients } from "../../db/schema/patients";
import { employeeRoles } from "../../db/schema/roles";
import { ROLE_DOCTOR } from "../auth/auth.constants";
import {
    assertUploadedFileForPatient,
    buildStoredFileUrl,
} from "../uploads/uploads.service";
import { LabRequestStatus } from "./labRequests.constants";
import { generateLabRequestCode } from "./labRequests.utils";

export interface CreateLabRequestInput {
    patientId: string;
    doctorId: string;
    clinicId: string;
    consultationId?: string | null;
    externalLabName?: string;
    tests: string[];
    notes?: string;
}

export interface ListLabRequestsOptions {
    page?: number;
    limit?: number;
    search?: string;
    clinicId?: string;
    doctorId?: string;
    doctorName?: string;
    status?: LabRequestStatus;
}

export interface UploadLabReportInput {
    fileId: string;
    reportName?: string;
}

export type LabRequestTestRow = typeof labRequestTests.$inferSelect;
export type LabReportRow = typeof labReports.$inferSelect;
export type LabRequestRow = typeof labRequests.$inferSelect;

export type LabRequestPatientSummary = {
    id: string;
    labRequestCode: string;
    status: LabRequestStatus;
    tests: LabRequestTestRow[];
    report: LabReportRow | null;
};

export type LabRequestDetails = {
    request: LabRequestRow;
    tests: LabRequestTestRow[];
    report: LabReportRow | null;
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

export const getLabRequestRecord = async (id: string) => {
    const [request] = await db
        .select()
        .from(labRequests)
        .where(eq(labRequests.id, id));

    if (!request) {
        throw new Error("Lab request not found");
    }

    return request;
};

const getTestsByLabRequestIds = async (labRequestIds: string[]) => {
    if (labRequestIds.length === 0) {
        return new Map<string, LabRequestTestRow[]>();
    }

    const rows = await db
        .select()
        .from(labRequestTests)
        .where(inArray(labRequestTests.labRequestId, labRequestIds));

    const testsByRequestId = new Map<string, LabRequestTestRow[]>();

    for (const row of rows) {
        const existing = testsByRequestId.get(row.labRequestId) ?? [];
        existing.push(row);
        testsByRequestId.set(row.labRequestId, existing);
    }

    return testsByRequestId;
};

const getReportsByLabRequestIds = async (labRequestIds: string[]) => {
    if (labRequestIds.length === 0) {
        return new Map<string, LabReportRow>();
    }

    const rows = await db
        .select()
        .from(labReports)
        .where(inArray(labReports.labRequestId, labRequestIds))
        .orderBy(desc(labReports.uploadedAt));

    const reportByRequestId = new Map<string, LabReportRow>();

    for (const row of rows) {
        if (!reportByRequestId.has(row.labRequestId)) {
            reportByRequestId.set(row.labRequestId, row);
        }
    }

    return reportByRequestId;
};

const toLabRequestDetails = async (
    request: LabRequestRow
): Promise<LabRequestDetails> => {
    const testsByRequestId = await getTestsByLabRequestIds([request.id]);
    const reportsByRequestId = await getReportsByLabRequestIds([request.id]);

    return {
        request,
        tests: testsByRequestId.get(request.id) ?? [],
        report: reportsByRequestId.get(request.id) ?? null,
    };
};

const toPatientSummary = (
    request: LabRequestRow,
    tests: LabRequestTestRow[],
    report: LabReportRow | null
): LabRequestPatientSummary => ({
    id: request.id,
    labRequestCode: request.labRequestCode,
    status: request.status,
    tests,
    report,
});

export const createLabRequest = async (input: CreateLabRequestInput) => {
    if (input.tests.length === 0) {
        throw new Error("At least one test required");
    }

    await assertClinicExists(input.clinicId);

    const patient = await assertPatientExists(input.patientId);
    if (patient.clinicId !== input.clinicId) {
        throw new Error("Patient does not belong to the selected clinic");
    }

    await assertDoctorInClinic(input.doctorId, input.clinicId);

    if (input.consultationId) {
        await assertConsultationForPatient(
            input.consultationId,
            input.patientId,
            input.clinicId
        );
    }

    const result = await db.transaction(async (tx) => {
        const labRequestCode = await generateLabRequestCode(tx);
        const now = new Date();

        const [request] = await tx
            .insert(labRequests)
            .values({
                labRequestCode,
                consultationId: input.consultationId ?? null,
                patientId: input.patientId,
                doctorId: input.doctorId,
                clinicId: input.clinicId,
                externalLabName: input.externalLabName,
                notes: input.notes,
                status: "sample_collected",
                collectedDate: now,
                createdAt: now,
                updatedAt: now,
            })
            .returning();

        const testRows = await tx
            .insert(labRequestTests)
            .values(
                input.tests.map((testName) => ({
                    labRequestId: request.id,
                    testName,
                }))
            )
            .returning();

        return {
            request,
            tests: testRows,
            report: null,
        } satisfies LabRequestDetails;
    });

    return result;
};

export const listLabRequests = async (options: ListLabRequestsOptions) => {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const offset = (page - 1) * limit;

    const filters: SQL[] = [];

    if (options.clinicId) {
        filters.push(eq(labRequests.clinicId, options.clinicId));
    }

    if (options.doctorId) {
        filters.push(eq(labRequests.doctorId, options.doctorId));
    }

    if (options.doctorName) {
        filters.push(ilike(employees.name, `%${options.doctorName}%`));
    }

    if (options.status) {
        filters.push(eq(labRequests.status, options.status));
    }

    if (options.search) {
        const term = `%${options.search}%`;
        filters.push(
            or(
                ilike(labRequests.labRequestCode, term),
                ilike(labRequests.externalLabName, term),
                ilike(patients.name, term)
            )!
        );
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const baseQuery = db
        .select({
            request: labRequests,
            patientName: patients.name,
            clinicName: clinics.clinicName,
            doctorName: employees.name,
        })
        .from(labRequests)
        .innerJoin(patients, eq(labRequests.patientId, patients.id))
        .innerJoin(clinics, eq(labRequests.clinicId, clinics.id))
        .innerJoin(employees, eq(labRequests.doctorId, employees.id));

    const [totalRow] = await db
        .select({ total: count() })
        .from(labRequests)
        .innerJoin(patients, eq(labRequests.patientId, patients.id))
        .innerJoin(clinics, eq(labRequests.clinicId, clinics.id))
        .innerJoin(employees, eq(labRequests.doctorId, employees.id))
        .where(whereClause);

    const rows = await baseQuery
        .where(whereClause)
        .orderBy(desc(labRequests.createdAt))
        .limit(limit)
        .offset(offset);

    const requestIds = rows.map((row) => row.request.id);
    const testsByRequestId = await getTestsByLabRequestIds(requestIds);
    const reportsByRequestId = await getReportsByLabRequestIds(requestIds);

    const items = rows.map((row) => {
        const {
            patientId: _patientId,
            clinicId: _clinicId,
            doctorId: _doctorId,
            ...request
        } = row.request;

        return {
            ...request,
            patientName: row.patientName,
            clinicName: row.clinicName,
            doctorName: row.doctorName,
            tests: testsByRequestId.get(row.request.id) ?? [],
            report: reportsByRequestId.get(row.request.id) ?? null,
        };
    });

    return {
        items,
        total: totalRow?.total ?? 0,
        page,
        limit,
    };
};

export const getLabRequestById = async (id: string) => {
    const request = await getLabRequestRecord(id);
    return toLabRequestDetails(request);
};

export const moveLabRequestToExamination = async (id: string) => {
    const request = await getLabRequestRecord(id);

    if (request.status !== "sample_collected") {
        throw new Error("Invalid status transition");
    }

    const now = new Date();

    const [updated] = await db
        .update(labRequests)
        .set({
            status: "under_examination",
            underExaminationDate: now,
            updatedAt: now,
        })
        .where(eq(labRequests.id, id))
        .returning();

    return toLabRequestDetails(updated);
};

export const deliverLabRequest = async (id: string) => {
    const request = await getLabRequestRecord(id);

    if (request.status !== "under_examination") {
        throw new Error("Invalid status transition");
    }

    const now = new Date();

    const [updated] = await db
        .update(labRequests)
        .set({
            status: "delivered",
            deliveredDate: now,
            updatedAt: now,
        })
        .where(eq(labRequests.id, id))
        .returning();

    return toLabRequestDetails(updated);
};

export const uploadLabReport = async (
    id: string,
    input: UploadLabReportInput
) => {
    const request = await getLabRequestRecord(id);

    if (request.status !== "delivered") {
        throw new Error("Report upload before delivery");
    }

    const file = await assertUploadedFileForPatient(
        input.fileId,
        request.patientId,
        "lab_report"
    );

    const [report] = await db
        .insert(labReports)
        .values({
            labRequestId: id,
            fileId: file.id,
            reportName: input.reportName ?? file.originalFileName,
            reportUrl: buildStoredFileUrl(file),
        })
        .returning();

    return report;
};

export const listLabRequestsByPatientId = async (patientId: string) => {
    await assertPatientExists(patientId);

    const requestRows = await db
        .select()
        .from(labRequests)
        .where(eq(labRequests.patientId, patientId))
        .orderBy(desc(labRequests.createdAt));

    const requestIds = requestRows.map((row) => row.id);
    const testsByRequestId = await getTestsByLabRequestIds(requestIds);
    const reportsByRequestId = await getReportsByLabRequestIds(requestIds);

    return requestRows.map((request) =>
        toPatientSummary(
            request,
            testsByRequestId.get(request.id) ?? [],
            reportsByRequestId.get(request.id) ?? null
        )
    );
};

export type LabRequestTimelineEvent = {
    type: string;
    date: string;
};

export const buildLabRequestTimelineEvents = (
    requestRows: LabRequestRow[],
    reportsByRequestId: Map<string, LabReportRow>
): LabRequestTimelineEvent[] => {
    const events: LabRequestTimelineEvent[] = [];

    for (const request of requestRows) {
        events.push({
            type: "lab_request_created",
            date: request.createdAt.toISOString(),
        });

        if (request.underExaminationDate) {
            events.push({
                type: "lab_request_under_examination",
                date: request.underExaminationDate.toISOString(),
            });
        }

        if (request.deliveredDate) {
            events.push({
                type: "lab_request_delivered",
                date: request.deliveredDate.toISOString(),
            });
        }

        const report = reportsByRequestId.get(request.id);
        if (report) {
            events.push({
                type: "lab_report_uploaded",
                date: report.uploadedAt.toISOString(),
            });
        }
    }

    return events;
};

export const getLabRequestTimelineEventsForPatient = async (
    patientId: string
) => {
    const requestRows = await db
        .select()
        .from(labRequests)
        .where(eq(labRequests.patientId, patientId));

    const requestIds = requestRows.map((row) => row.id);
    const reportsByRequestId = await getReportsByLabRequestIds(requestIds);

    return buildLabRequestTimelineEvents(requestRows, reportsByRequestId);
};
