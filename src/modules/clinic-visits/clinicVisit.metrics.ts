import { and, count, eq, gte, inArray, lte, SQL } from "drizzle-orm";
import { db } from "../../db/client";
import { clinicVisitFiles } from "../../db/schema/clinicVisitFiles";
import { clinicVisits } from "../../db/schema/clinicVisits";
import { clinics } from "../../db/schema/clinic";
import { employees } from "../../db/schema/employees";
import { ClinicVisitRow } from "./clinicVisit.service";
import {
    clinicCalendarDayEnd,
    clinicCalendarDayStart,
    startOfZonedDay,
} from "../scheduling/scheduling.utils";
import { CLINIC_TIMEZONE } from "../scheduling/scheduling.constants";

export type ClinicVisitTimelineEvent = {
    type: string;
    date: string;
};

export const buildClinicVisitTimelineEvents = (
    visits: ClinicVisitRow[],
    medicalRecordCounts: Map<string, number>
): ClinicVisitTimelineEvent[] => {
    const events: ClinicVisitTimelineEvent[] = [];

    for (const visit of visits) {
        events.push({
            type: "visitor_checked_in",
            date: visit.checkInTime.toISOString(),
        });

        if (visit.appointmentId) {
            events.push({
                type: "appointment_created",
                date: visit.checkInTime.toISOString(),
            });
        }

        if (visit.isRegistered && visit.patientId) {
            events.push({
                type: "patient_registered",
                date: visit.updatedAt.toISOString(),
            });
        }

        if (visit.consultationId) {
            events.push({
                type: "consultation_started",
                date: visit.updatedAt.toISOString(),
            });
        }

        if (visit.outcome === "consultation_completed") {
            events.push({
                type: "consultation_completed",
                date: visit.updatedAt.toISOString(),
            });
        }

        if (visit.outcome === "treatment_started") {
            events.push({
                type: "treatment_started",
                date: visit.updatedAt.toISOString(),
            });
        }

        if (visit.outcome === "treatment_completed") {
            events.push({
                type: "treatment_completed",
                date: visit.updatedAt.toISOString(),
            });
        }

        if (visit.membershipId) {
            events.push({
                type: "membership_purchased",
                date: visit.updatedAt.toISOString(),
            });
        }

        if (visit.invoiceId) {
            events.push({
                type: "billing_completed",
                date: visit.updatedAt.toISOString(),
            });
        }

        if (visit.outcome === "reports_collected") {
            events.push({
                type: "reports_collected",
                date: visit.updatedAt.toISOString(),
            });
        }

        if ((medicalRecordCounts.get(visit.id) ?? 0) > 0) {
            events.push({
                type: "medical_records_attached",
                date: visit.updatedAt.toISOString(),
            });
        }

        if (visit.checkOutTime) {
            events.push({
                type: "visitor_checked_out",
                date: visit.checkOutTime.toISOString(),
            });
        }
    }

    return events;
};

export const getClinicVisitTimelineEventsForPatient = async (
    patientId: string
) => {
    const visits = await db
        .select()
        .from(clinicVisits)
        .where(eq(clinicVisits.patientId, patientId));

    const visitIds = visits.map((visit) => visit.id);
    const medicalRecordCounts = new Map<string, number>();

    if (visitIds.length > 0) {
        const fileRows = await db
            .select({
                clinicVisitId: clinicVisitFiles.clinicVisitId,
                total: count(),
            })
            .from(clinicVisitFiles)
            .where(inArray(clinicVisitFiles.clinicVisitId, visitIds))
            .groupBy(clinicVisitFiles.clinicVisitId);

        for (const row of fileRows) {
            medicalRecordCounts.set(row.clinicVisitId, row.total);
        }
    }

    return buildClinicVisitTimelineEvents(visits, medicalRecordCounts);
};

export const getClinicVisitDashboardMetrics = async (options: {
    clinicId?: string;
    dateFrom?: Date;
    dateTo?: Date;
}) => {
    const filters: SQL[] = [];

    if (options.clinicId) {
        filters.push(eq(clinicVisits.clinicId, options.clinicId));
    }

    if (options.dateFrom) {
        filters.push(gte(clinicVisits.visitDate, clinicCalendarDayStart(options.dateFrom)));
    }

    if (options.dateTo) {
        filters.push(lte(clinicVisits.visitDate, clinicCalendarDayEnd(options.dateTo)));
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;
    const rows = await db.select().from(clinicVisits).where(whereClause);

    const totalVisitors = rows.length;
    const registeredPatients = rows.filter((row) => row.isRegistered).length;
    const walkIns = rows.filter((row) => !row.appointmentId).length;
    const enquiries = rows.filter((row) => row.purpose === "enquiry").length;
    const treatments = rows.filter(
        (row) =>
            row.purpose === "treatment" ||
            row.outcome === "treatment_started" ||
            row.outcome === "treatment_completed"
    ).length;
    const consultations = rows.filter(
        (row) => row.consultationId !== null || row.purpose === "consultation"
    ).length;
    const membershipSales = rows.filter(
        (row) => row.outcome === "membership_purchased" || row.membershipId
    ).length;
    const billingVisits = rows.filter(
        (row) => row.purpose === "billing" || row.invoiceId
    ).length;
    const emergencyVisits = rows.filter(
        (row) => row.purpose === "emergency"
    ).length;

    const uniqueDays = new Set(
        rows.map((row) => startOfZonedDay(CLINIC_TIMEZONE, row.visitDate).toISOString())
    );
    const averageDailyVisits =
        uniqueDays.size > 0
            ? Math.round((totalVisitors / uniqueDays.size) * 100) / 100
            : 0;

    const doctorWiseMap = new Map<string, number>();
    const clinicWiseMap = new Map<string, number>();

    for (const row of rows) {
        clinicWiseMap.set(
            row.clinicId,
            (clinicWiseMap.get(row.clinicId) ?? 0) + 1
        );

        if (row.doctorId) {
            doctorWiseMap.set(
                row.doctorId,
                (doctorWiseMap.get(row.doctorId) ?? 0) + 1
            );
        }
    }

    const doctorIds = [...doctorWiseMap.keys()];
    const clinicIds = [...clinicWiseMap.keys()];

    const doctorRows =
        doctorIds.length > 0
            ? await db
                  .select({ id: employees.id, name: employees.name })
                  .from(employees)
                  .where(inArray(employees.id, doctorIds))
            : [];

    const clinicRows =
        clinicIds.length > 0
            ? await db
                  .select({ id: clinics.id, clinicName: clinics.clinicName })
                  .from(clinics)
                  .where(inArray(clinics.id, clinicIds))
            : [];

    return {
        totalVisitors,
        registeredPatients,
        walkIns,
        enquiries,
        treatments,
        consultations,
        membershipSales,
        billingVisits,
        emergencyVisits,
        averageDailyVisits,
        doctorWiseVisits: doctorRows.map((doctor) => ({
            doctorId: doctor.id,
            doctorName: doctor.name,
            count: doctorWiseMap.get(doctor.id) ?? 0,
        })),
        clinicWiseVisits: clinicRows.map((clinic) => ({
            clinicId: clinic.id,
            clinicName: clinic.clinicName,
            count: clinicWiseMap.get(clinic.id) ?? 0,
        })),
    };
};
