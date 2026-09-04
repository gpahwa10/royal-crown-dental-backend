import {
    and,
    count,
    desc,
    eq,
    gte,
    inArray,
    isNull,
    lte,
    ne,
    or,
    sql,
    SQL,
    sum,
} from "drizzle-orm";
import { db } from "../../db/client";
import { appointments } from "../../db/schema/appointments";
import { clinics } from "../../db/schema/clinic";
import { dentalLabOrders } from "../../db/schema/dentalLabOrders";
import { employees } from "../../db/schema/employees";
import { followUps } from "../../db/schema/followups";
import { inventoryItem } from "../../db/schema/inventoryItems";
import { inventoryStock } from "../../db/schema/inventoryStocks";
import { inventoryVariant } from "../../db/schema/inventoryVariants";
import { invoices } from "../../db/schema/invoices";
import { labRequests } from "../../db/schema/labRequests";
import { leads } from "../../db/schema/leads";
import { membershipPlans } from "../../db/schema/membershipPlans";
import { patientMemberships } from "../../db/schema/patientMemberships";
import { patients } from "../../db/schema/patients";
import { payments } from "../../db/schema/payments";
import { radiographs } from "../../db/schema/radiographs";
import {
    AlertItem,
    AlertsAnalyticsResponse,
    AppointmentsAnalyticsResponse,
    ChartPoint,
    DashboardSummary,
    DateRangeInfo,
    GrowthMetric,
    LeadsAnalyticsResponse,
    PatientsAnalyticsResponse,
    PaymentsAnalyticsResponse,
    RecentActivityItem,
    RevenueAnalyticsResponse,
    TopPerformerItem,
} from "./analytics.types";
import {
    AnalyticsFiltersInput,
    comparisonPeriodEnum,
} from "./analytics.validation";
import {
    computeGrowthMetric,
    endOfZonedDay,
    inferGroupByUnit,
    resolveDateRange,
    resolveEffectiveScope,
    startOfZonedDay,
} from "./analytics.utils";
import { CLINIC_TIMEZONE } from "../scheduling/scheduling.constants";

type Scope = {
    clinicId?: string;
    doctorId?: string;
};

type ResolvedFilters = {
    dateRange: DateRangeInfo;
    groupBy: NonNullable<DateRangeInfo["groupBy"]>;
    scope: Scope;
    filtersApplied: DashboardSummary["filters"];
};

const resolveFilters = (filters: AnalyticsFiltersInput): ResolvedFilters => {
    const dateRange = resolveDateRange({
        startDate: filters.startDate,
        endDate: filters.endDate,
        datePreset: filters.datePreset,
        comparisonPeriod: comparisonPeriodEnum.parse(filters.comparisonPeriod),
    });
    const groupBy = filters.groupBy ?? inferGroupByUnit(dateRange);
    const scope = resolveEffectiveScope({
        req: { employee: filters.employee } as any,
        clinicId: filters.clinicId,
        doctorId: filters.doctorId,
    });

    return {
        dateRange,
        groupBy,
        scope: {
            clinicId: scope.clinicId,
            doctorId: scope.doctorId,
        },
        filtersApplied: {
            clinicId: scope.clinicId,
            doctorId: scope.doctorId,
            startDate: dateRange.startDate.toISOString(),
            endDate: dateRange.endDate.toISOString(),
            comparisonPeriod: filters.comparisonPeriod,
            groupBy,
        },
    };
};

const dateBetween = (
    column: any,
    startDate: Date,
    endDate: Date
): SQL => and(gte(column, startDate), lte(column, endDate))!;

const startOfToday = () => startOfZonedDay(CLINIC_TIMEZONE);

const endOfToday = () => endOfZonedDay(CLINIC_TIMEZONE);

const startOfDayInDays = (daysFromToday: number) => {
    const d = startOfToday();
    d.setTime(d.getTime() + daysFromToday * 24 * 60 * 60 * 1000);
    return d;
};

const countRows = async (
    query: Promise<{ value: number }[]>
): Promise<number> => {
    const [row] = await query;
    return Number(row?.value ?? 0);
};

const sumRows = async (
    query: Promise<{ value: string | number | null }[]>
): Promise<number> => {
    const [row] = await query;
    return Number(row?.value ?? 0);
};

const truncUnit = (groupBy: string) => {
    switch (groupBy) {
        case "week":
            return "week";
        case "month":
            return "month";
        case "quarter":
            return "quarter";
        case "year":
            return "year";
        default:
            return "day";
    }
};

const formatBucketLabel = (value: Date | string, groupBy: string) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");

    switch (groupBy) {
        case "week":
            return `${yyyy}-W${String(Math.ceil(date.getDate() / 7)).padStart(2, "0")}`;
        case "month":
            return `${yyyy}-${mm}`;
        case "quarter":
            return `${yyyy}-Q${Math.floor(date.getMonth() / 3) + 1}`;
        case "year":
            return `${yyyy}`;
        default:
            return `${yyyy}-${mm}-${dd}`;
    }
};

const growthForRange = async (params: {
    current: number;
    previousFetcher: () => Promise<number>;
    dateRange: DateRangeInfo;
}): Promise<GrowthMetric> => {
    const previous =
        params.dateRange.comparisonStartDate && params.dateRange.comparisonEndDate
            ? await params.previousFetcher()
            : 0;

    return computeGrowthMetric({
        current: params.current,
        previous,
    });
};

const clinicFilter = (column: any, clinicId?: string) =>
    clinicId ? eq(column, clinicId) : undefined;

const doctorAppointmentFilter = (doctorId?: string) =>
    doctorId ? eq(appointments.employeeId, doctorId) : undefined;

const countPatientsInRange = async (
    scope: Scope,
    startDate: Date,
    endDate: Date
) =>
    countRows(
        db
            .select({ value: count() })
            .from(patients)
            .where(
                and(
                    clinicFilter(patients.clinicId, scope.clinicId),
                    dateBetween(patients.createdAt, startDate, endDate)
                )
            )
    );

const countLeadsInRange = async (
    scope: Scope,
    startDate: Date,
    endDate: Date,
    status?: string | string[]
) => {
    const statusFilter = Array.isArray(status)
        ? inArray(leads.status, status as any)
        : status
          ? eq(leads.status, status as any)
          : undefined;

    return countRows(
        db
            .select({ value: count() })
            .from(leads)
            .where(
                and(
                    clinicFilter(leads.clinicId, scope.clinicId),
                    dateBetween(leads.createdAt, startDate, endDate),
                    statusFilter
                )
            )
    );
};

const countAppointmentsInRange = async (
    scope: Scope,
    startDate: Date,
    endDate: Date,
    status?: string | string[]
) => {
    const statusFilter = Array.isArray(status)
        ? inArray(appointments.status, status as any)
        : status
          ? eq(appointments.status, status as any)
          : undefined;

    return countRows(
        db
            .select({ value: count() })
            .from(appointments)
            .where(
                and(
                    clinicFilter(appointments.clinicId, scope.clinicId),
                    doctorAppointmentFilter(scope.doctorId),
                    dateBetween(appointments.scheduledAt, startDate, endDate),
                    statusFilter
                )
            )
    );
};

const sumInvoiceFieldInRange = async (
    field: typeof invoices.grandTotal | typeof invoices.amountPaid | typeof invoices.balanceAmount,
    scope: Scope,
    startDate: Date,
    endDate: Date,
    statuses?: string[]
) =>
    sumRows(
        db
            .select({ value: sum(field) })
            .from(invoices)
            .where(
                and(
                    clinicFilter(invoices.clinicId, scope.clinicId),
                    dateBetween(invoices.createdAt, startDate, endDate),
                    statuses ? inArray(invoices.status, statuses as any) : ne(invoices.status, "cancelled"),
                    scope.doctorId
                        ? eq(invoices.generatedBy, scope.doctorId)
                        : undefined
                )
            )
    );

const sumPaymentsInRange = async (
    scope: Scope,
    startDate: Date,
    endDate: Date
) =>
    sumRows(
        db
            .select({ value: sum(payments.amount) })
            .from(payments)
            .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
            .where(
                and(
                    clinicFilter(invoices.clinicId, scope.clinicId),
                    dateBetween(payments.paymentDate, startDate, endDate),
                    scope.doctorId
                        ? eq(invoices.generatedBy, scope.doctorId)
                        : undefined
                )
            )
    );

const sumInvoiceBySource = async (
    sourceType: string,
    scope: Scope,
    startDate: Date,
    endDate: Date
) =>
    sumRows(
        db
            .select({ value: sum(invoices.grandTotal) })
            .from(invoices)
            .where(
                and(
                    clinicFilter(invoices.clinicId, scope.clinicId),
                    eq(invoices.sourceType, sourceType as any),
                    dateBetween(invoices.createdAt, startDate, endDate),
                    ne(invoices.status, "cancelled")
                )
            )
    );

const buildTimeSeries = async (params: {
    table: any;
    dateColumn: any;
    valueExpr?: any;
    scopeClinicColumn?: any;
    scopeClinicId?: string;
    extraFilters?: SQL[];
    startDate: Date;
    endDate: Date;
    groupBy: string;
}): Promise<ChartPoint[]> => {
    const unit = truncUnit(params.groupBy);
    const bucket = sql`date_trunc(${sql.raw(`'${unit}'`)}, ${params.dateColumn})`;

    const filters: (SQL | undefined)[] = [
        dateBetween(params.dateColumn, params.startDate, params.endDate),
        params.scopeClinicColumn && params.scopeClinicId
            ? eq(params.scopeClinicColumn, params.scopeClinicId)
            : undefined,
        ...(params.extraFilters ?? []),
    ];

    const rows = await db
        .select({
            bucket,
            value: params.valueExpr
                ? sum(params.valueExpr)
                : count(),
        })
        .from(params.table)
        .where(and(...filters))
        .groupBy(bucket)
        .orderBy(bucket);

    return rows.map((row) => ({
        label: formatBucketLabel(row.bucket as Date, params.groupBy),
        value: Number(row.value ?? 0),
    }));
};

const getAlerts = async (scope: Scope): Promise<AlertItem[]> => {
    const today = startOfToday();
    const in7Days = startOfDayInDays(7);
    const alerts: AlertItem[] = [];

    const lowStock = await countRows(
        db
            .select({ value: count() })
            .from(inventoryStock)
            .innerJoin(
                inventoryVariant,
                eq(inventoryStock.variantId, inventoryVariant.id)
            )
            .innerJoin(
                inventoryItem,
                eq(inventoryVariant.inventoryItemId, inventoryItem.id)
            )
            .where(
                and(
                    eq(inventoryVariant.isActive, true),
                    eq(inventoryItem.isActive, true),
                    scope.clinicId
                        ? eq(inventoryStock.clinicId, scope.clinicId)
                        : undefined,
                    scope.clinicId
                        ? or(
                              eq(inventoryItem.clinicId, scope.clinicId),
                              isNull(inventoryItem.clinicId)
                          )
                        : undefined,
                    sql`${inventoryStock.inStock} < COALESCE(NULLIF(${inventoryStock.requiredStock}, 0), ${inventoryItem.minimumStockLevel})`
                )
            )
    );

    if (lowStock > 0) {
        alerts.push({
            type: "low_inventory",
            label: "Low inventory items",
            severity: lowStock > 10 ? "critical" : "warning",
            count: lowStock,
        });
    }

    const pendingLab = await countRows(
        db
            .select({ value: count() })
            .from(labRequests)
            .where(
                and(
                    clinicFilter(labRequests.clinicId, scope.clinicId),
                    inArray(labRequests.status, [
                        "sample_collected",
                        "under_examination",
                    ])
                )
            )
    );
    if (pendingLab > 0) {
        alerts.push({
            type: "pending_lab_reports",
            label: "Pending lab requests",
            severity: "warning",
            count: pendingLab,
        });
    }

    const pendingRadiographs = await countRows(
        db
            .select({ value: count() })
            .from(radiographs)
            .where(
                and(
                    clinicFilter(radiographs.clinicId, scope.clinicId),
                    inArray(radiographs.status, ["scheduled", "acquired"])
                )
            )
    );
    if (pendingRadiographs > 0) {
        alerts.push({
            type: "pending_radiographs",
            label: "Pending radiographs",
            severity: "warning",
            count: pendingRadiographs,
        });
    }

    const pendingDentalLab = await countRows(
        db
            .select({ value: count() })
            .from(dentalLabOrders)
            .where(
                and(
                    clinicFilter(dentalLabOrders.clinicId, scope.clinicId),
                    eq(dentalLabOrders.status, "ordered")
                )
            )
    );
    if (pendingDentalLab > 0) {
        alerts.push({
            type: "pending_dental_lab_orders",
            label: "Pending dental lab orders",
            severity: "warning",
            count: pendingDentalLab,
        });
    }

    const delayedDentalLab = await countRows(
        db
            .select({ value: count() })
            .from(dentalLabOrders)
            .where(
                and(
                    clinicFilter(dentalLabOrders.clinicId, scope.clinicId),
                    eq(dentalLabOrders.status, "ordered"),
                    lte(dentalLabOrders.estimatedDeliveryDate, today)
                )
            )
    );
    if (delayedDentalLab > 0) {
        alerts.push({
            type: "delayed_dental_lab_orders",
            label: "Delayed dental lab orders",
            severity: "critical",
            count: delayedDentalLab,
        });
    }

    const outstandingPayments = await countRows(
        db
            .select({ value: count() })
            .from(invoices)
            .where(
                and(
                    clinicFilter(invoices.clinicId, scope.clinicId),
                    inArray(invoices.status, ["pending", "partially_paid"]),
                    sql`${invoices.balanceAmount} > 0`
                )
            )
    );
    if (outstandingPayments > 0) {
        alerts.push({
            type: "outstanding_payments",
            label: "Outstanding invoices",
            severity: outstandingPayments > 20 ? "critical" : "warning",
            count: outstandingPayments,
        });
    }

    const expiringMemberships = await countRows(
        db
            .select({ value: count() })
            .from(patientMemberships)
            .innerJoin(patients, eq(patientMemberships.patientId, patients.id))
            .where(
                and(
                    clinicFilter(patients.clinicId, scope.clinicId),
                    eq(patientMemberships.status, "active"),
                    gte(patientMemberships.expiryDate, today),
                    lte(patientMemberships.expiryDate, in7Days)
                )
            )
    );
    if (expiringMemberships > 0) {
        alerts.push({
            type: "expiring_memberships",
            label: "Memberships expiring within 7 days",
            severity: "info",
            count: expiringMemberships,
        });
    }

    const expiredMemberships = await countRows(
        db
            .select({ value: count() })
            .from(patientMemberships)
            .innerJoin(patients, eq(patientMemberships.patientId, patients.id))
            .where(
                and(
                    clinicFilter(patients.clinicId, scope.clinicId),
                    or(
                        eq(patientMemberships.status, "expired"),
                        and(
                            eq(patientMemberships.status, "active"),
                            lte(patientMemberships.expiryDate, today)
                        )
                    )
                )
            )
    );
    if (expiredMemberships > 0) {
        alerts.push({
            type: "expired_memberships",
            label: "Expired memberships",
            severity: "warning",
            count: expiredMemberships,
        });
    }

    const noShows = await countAppointmentsInRange(
        scope,
        startOfDayInDays(-7),
        endOfToday(),
        "no_show"
    );
    if (noShows > 0) {
        alerts.push({
            type: "no_show_patients",
            label: "No-shows in last 7 days",
            severity: "info",
            count: noShows,
        });
    }

    const cancelled = await countAppointmentsInRange(
        scope,
        startOfDayInDays(-7),
        endOfToday(),
        "cancelled"
    );
    if (cancelled > 0) {
        alerts.push({
            type: "cancelled_appointments",
            label: "Cancelled appointments in last 7 days",
            severity: "info",
            count: cancelled,
        });
    }

    const pendingFollowUps = await countRows(
        db
            .select({ value: count() })
            .from(followUps)
            .innerJoin(patients, eq(followUps.patientId, patients.id))
            .where(
                and(
                    clinicFilter(patients.clinicId, scope.clinicId),
                    eq(followUps.completed, false),
                    lte(followUps.followUpDate, in7Days)
                )
            )
    );
    if (pendingFollowUps > 0) {
        alerts.push({
            type: "pending_follow_ups",
            label: "Pending follow-ups",
            severity: "warning",
            count: pendingFollowUps,
        });
    }

    return alerts;
};

const getRecentActivities = async (
    scope: Scope
): Promise<RecentActivityItem[]> => {
    const [recentPatients, recentInvoices, recentPayments, recentLeads] =
        await Promise.all([
            db
                .select({
                    id: patients.id,
                    clinicId: patients.clinicId,
                    name: patients.name,
                    occurredAt: patients.createdAt,
                })
                .from(patients)
                .where(clinicFilter(patients.clinicId, scope.clinicId))
                .orderBy(desc(patients.createdAt))
                .limit(5),
            db
                .select({
                    id: invoices.id,
                    clinicId: invoices.clinicId,
                    patientId: invoices.patientId,
                    invoiceNumber: invoices.invoiceNumber,
                    occurredAt: invoices.createdAt,
                })
                .from(invoices)
                .where(clinicFilter(invoices.clinicId, scope.clinicId))
                .orderBy(desc(invoices.createdAt))
                .limit(5),
            db
                .select({
                    id: payments.id,
                    clinicId: invoices.clinicId,
                    patientId: invoices.patientId,
                    amount: payments.amount,
                    occurredAt: payments.paymentDate,
                })
                .from(payments)
                .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
                .where(clinicFilter(invoices.clinicId, scope.clinicId))
                .orderBy(desc(payments.paymentDate))
                .limit(5),
            db
                .select({
                    id: leads.id,
                    clinicId: leads.clinicId,
                    name: leads.name,
                    createdAt: leads.createdAt,
                    updatedAt: leads.updatedAt,
                })
                .from(leads)
                .where(clinicFilter(leads.clinicId, scope.clinicId))
                // Prefer updatedAt so phone-number upserts (createLead updates) also surface.
                .orderBy(desc(leads.updatedAt))
                .limit(5),
        ]);

    const activities: RecentActivityItem[] = [
        ...recentPatients.map((row) => ({
            type: "patient_registered" as const,
            id: row.id,
            clinicId: row.clinicId,
            patientId: row.id,
            label: `Patient registered: ${row.name}`,
            occurredAt: row.occurredAt.toISOString(),
        })),
        ...recentInvoices.map((row) => ({
            type: "invoice_generated" as const,
            id: row.id,
            clinicId: row.clinicId,
            patientId: row.patientId,
            label: `Invoice generated: ${row.invoiceNumber}`,
            occurredAt: row.occurredAt.toISOString(),
        })),
        ...recentPayments.map((row) => ({
            type: "payment_received" as const,
            id: row.id,
            clinicId: row.clinicId,
            patientId: row.patientId,
            label: `Payment received: ${row.amount}`,
            occurredAt: row.occurredAt.toISOString(),
        })),
        ...recentLeads.map((row) => {
            const createdMs = row.createdAt.getTime();
            const updatedMs = row.updatedAt.getTime();
            const isFreshCreate = Math.abs(updatedMs - createdMs) < 5_000;
            return {
                type: "lead_created" as const,
                id: row.id,
                clinicId: row.clinicId,
                label: isFreshCreate
                    ? `Lead created: ${row.name}`
                    : `Lead updated: ${row.name}`,
                occurredAt: row.updatedAt.toISOString(),
                meta: { entity: "lead", isFreshCreate },
            };
        }),
    ];

    return activities
        .sort(
            (a, b) =>
                new Date(b.occurredAt).getTime() -
                new Date(a.occurredAt).getTime()
        )
        .slice(0, 15);
};

const getTopDoctors = async (
    scope: Scope,
    dateRange: DateRangeInfo
): Promise<TopPerformerItem[]> => {
    const rows = await db
        .select({
            id: employees.id,
            name: employees.name,
            clinicId: employees.clinicId,
            value: count(),
        })
        .from(appointments)
        .innerJoin(employees, eq(appointments.employeeId, employees.id))
        .where(
            and(
                clinicFilter(appointments.clinicId, scope.clinicId),
                dateBetween(
                    appointments.scheduledAt,
                    dateRange.startDate,
                    dateRange.endDate
                ),
                eq(appointments.status, "completed")
            )
        )
        .groupBy(employees.id, employees.name, employees.clinicId)
        .orderBy(desc(count()))
        .limit(5);

    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        clinicId: row.clinicId,
        value: Number(row.value),
        metric: "completed_appointments",
    }));
};

const getTopClinics = async (
    dateRange: DateRangeInfo
): Promise<TopPerformerItem[]> => {
    const rows = await db
        .select({
            id: clinics.id,
            name: clinics.clinicName,
            value: sum(invoices.grandTotal),
        })
        .from(invoices)
        .innerJoin(clinics, eq(invoices.clinicId, clinics.id))
        .where(
            and(
                dateBetween(
                    invoices.createdAt,
                    dateRange.startDate,
                    dateRange.endDate
                ),
                ne(invoices.status, "cancelled")
            )
        )
        .groupBy(clinics.id, clinics.clinicName)
        .orderBy(desc(sum(invoices.grandTotal)))
        .limit(5);

    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        clinicId: row.id,
        value: Number(row.value ?? 0),
        metric: "gross_revenue",
    }));
};

const getTopMembershipPlans = async (
    scope: Scope,
    dateRange: DateRangeInfo
): Promise<TopPerformerItem[]> => {
    const rows = await db
        .select({
            id: membershipPlans.id,
            name: membershipPlans.planName,
            value: count(),
        })
        .from(patientMemberships)
        .innerJoin(
            membershipPlans,
            eq(patientMemberships.membershipPlanId, membershipPlans.id)
        )
        .innerJoin(patients, eq(patientMemberships.patientId, patients.id))
        .where(
            and(
                clinicFilter(patients.clinicId, scope.clinicId),
                dateBetween(
                    patientMemberships.purchaseDate,
                    dateRange.startDate,
                    dateRange.endDate
                )
            )
        )
        .groupBy(membershipPlans.id, membershipPlans.planName)
        .orderBy(desc(count()))
        .limit(5);

    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        value: Number(row.value),
        metric: "memberships_sold",
    }));
};

export const getDashboardAnalytics = async (
    filters: AnalyticsFiltersInput
): Promise<DashboardSummary> => {
    const { dateRange, groupBy, scope, filtersApplied } = resolveFilters(filters);
    const { startDate, endDate, comparisonStartDate, comparisonEndDate } =
        dateRange;

    const [
        patientsCurrent,
        patientsPrevious,
        leadsCurrent,
        leadsPrevious,
        appointmentsCurrent,
        appointmentsPrevious,
        grossCurrent,
        grossPrevious,
        collectedCurrent,
        collectedPrevious,
        appointmentsToday,
        revenueChart,
        appointmentsChart,
        patientsChart,
        leadsChart,
        paymentsChart,
        membershipChart,
        alerts,
        topDoctors,
        topClinics,
        topMembershipPlans,
        recentActivities,
        outstandingInvoices,
        activeMemberships,
        pendingLab,
        pendingDentalLab,
    ] = await Promise.all([
        countPatientsInRange(scope, startDate, endDate),
        comparisonStartDate && comparisonEndDate
            ? countPatientsInRange(scope, comparisonStartDate, comparisonEndDate)
            : Promise.resolve(0),
        countLeadsInRange(scope, startDate, endDate),
        comparisonStartDate && comparisonEndDate
            ? countLeadsInRange(scope, comparisonStartDate, comparisonEndDate)
            : Promise.resolve(0),
        countAppointmentsInRange(scope, startDate, endDate),
        comparisonStartDate && comparisonEndDate
            ? countAppointmentsInRange(
                  scope,
                  comparisonStartDate,
                  comparisonEndDate
              )
            : Promise.resolve(0),
        sumInvoiceFieldInRange(invoices.grandTotal, scope, startDate, endDate),
        comparisonStartDate && comparisonEndDate
            ? sumInvoiceFieldInRange(
                  invoices.grandTotal,
                  scope,
                  comparisonStartDate,
                  comparisonEndDate
              )
            : Promise.resolve(0),
        sumPaymentsInRange(scope, startDate, endDate),
        comparisonStartDate && comparisonEndDate
            ? sumPaymentsInRange(scope, comparisonStartDate, comparisonEndDate)
            : Promise.resolve(0),
        countAppointmentsInRange(scope, startOfToday(), endOfToday()),
        buildTimeSeries({
            table: invoices,
            dateColumn: invoices.createdAt,
            valueExpr: invoices.grandTotal,
            scopeClinicColumn: invoices.clinicId,
            scopeClinicId: scope.clinicId,
            extraFilters: [ne(invoices.status, "cancelled")],
            startDate,
            endDate,
            groupBy,
        }),
        buildTimeSeries({
            table: appointments,
            dateColumn: appointments.scheduledAt,
            scopeClinicColumn: appointments.clinicId,
            scopeClinicId: scope.clinicId,
            extraFilters: scope.doctorId
                ? [eq(appointments.employeeId, scope.doctorId)]
                : [],
            startDate,
            endDate,
            groupBy,
        }),
        buildTimeSeries({
            table: patients,
            dateColumn: patients.createdAt,
            scopeClinicColumn: patients.clinicId,
            scopeClinicId: scope.clinicId,
            startDate,
            endDate,
            groupBy,
        }),
        buildTimeSeries({
            table: leads,
            dateColumn: leads.createdAt,
            scopeClinicColumn: leads.clinicId,
            scopeClinicId: scope.clinicId,
            startDate,
            endDate,
            groupBy,
        }),
        (async () => {
            const unit = truncUnit(groupBy);
            const bucket = sql`date_trunc(${sql.raw(`'${unit}'`)}, ${payments.paymentDate})`;
            const rows = await db
                .select({
                    bucket,
                    value: sum(payments.amount),
                })
                .from(payments)
                .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
                .where(
                    and(
                        clinicFilter(invoices.clinicId, scope.clinicId),
                        dateBetween(payments.paymentDate, startDate, endDate)
                    )
                )
                .groupBy(bucket)
                .orderBy(bucket);

            return rows.map((row) => ({
                label: formatBucketLabel(row.bucket as Date, groupBy),
                value: Number(row.value ?? 0),
            }));
        })(),
        (async () => {
            const unit = truncUnit(groupBy);
            const bucket = sql`date_trunc(${sql.raw(`'${unit}'`)}, ${patientMemberships.purchaseDate})`;
            const rows = await db
                .select({
                    bucket,
                    value: count(),
                })
                .from(patientMemberships)
                .innerJoin(patients, eq(patientMemberships.patientId, patients.id))
                .where(
                    and(
                        clinicFilter(patients.clinicId, scope.clinicId),
                        dateBetween(
                            patientMemberships.purchaseDate,
                            startDate,
                            endDate
                        )
                    )
                )
                .groupBy(bucket)
                .orderBy(bucket);

            return rows.map((row) => ({
                label: formatBucketLabel(row.bucket as Date, groupBy),
                value: Number(row.value ?? 0),
            }));
        })(),
        getAlerts(scope),
        getTopDoctors(scope, dateRange),
        scope.clinicId ? Promise.resolve([]) : getTopClinics(dateRange),
        getTopMembershipPlans(scope, dateRange),
        getRecentActivities(scope),
        countRows(
            db
                .select({ value: count() })
                .from(invoices)
                .where(
                    and(
                        clinicFilter(invoices.clinicId, scope.clinicId),
                        inArray(invoices.status, ["pending", "partially_paid"]),
                        sql`${invoices.balanceAmount} > 0`
                    )
                )
        ),
        countRows(
            db
                .select({ value: count() })
                .from(patientMemberships)
                .innerJoin(patients, eq(patientMemberships.patientId, patients.id))
                .where(
                    and(
                        clinicFilter(patients.clinicId, scope.clinicId),
                        eq(patientMemberships.status, "active")
                    )
                )
        ),
        countRows(
            db
                .select({ value: count() })
                .from(labRequests)
                .where(
                    and(
                        clinicFilter(labRequests.clinicId, scope.clinicId),
                        inArray(labRequests.status, [
                            "sample_collected",
                            "under_examination",
                        ])
                    )
                )
        ),
        countRows(
            db
                .select({ value: count() })
                .from(dentalLabOrders)
                .where(
                    and(
                        clinicFilter(dentalLabOrders.clinicId, scope.clinicId),
                        eq(dentalLabOrders.status, "ordered")
                    )
                )
        ),
    ]);

    return {
        filters: filtersApplied,
        kpis: {
            patients: computeGrowthMetric({
                current: patientsCurrent,
                previous: patientsPrevious,
            }),
            leads: computeGrowthMetric({
                current: leadsCurrent,
                previous: leadsPrevious,
            }),
            appointments: computeGrowthMetric({
                current: appointmentsCurrent,
                previous: appointmentsPrevious,
            }),
            grossRevenue: computeGrowthMetric({
                current: grossCurrent,
                previous: grossPrevious,
            }),
            collectedRevenue: computeGrowthMetric({
                current: collectedCurrent,
                previous: collectedPrevious,
            }),
            appointmentsToday,
        },
        charts: {
            revenue: revenueChart,
            appointments: appointmentsChart,
            patients: patientsChart,
            leads: leadsChart,
            payments: paymentsChart,
            memberships: membershipChart,
        },
        alerts,
        topDoctors,
        topClinics,
        topTreatments: [],
        topMembershipPlans,
        recentActivities,
        quickStats: {
            outstandingInvoices,
            activeMemberships,
            pendingLabRequests: pendingLab,
            pendingDentalLabOrders: pendingDentalLab,
            appointmentsToday,
        },
        exportSupportedFormats: ["pdf", "excel", "csv"],
    };
};

export const getRevenueAnalytics = async (
    filters: AnalyticsFiltersInput
): Promise<RevenueAnalyticsResponse> => {
    const { dateRange, groupBy, scope, filtersApplied } = resolveFilters(filters);
    const { startDate, endDate, comparisonStartDate, comparisonEndDate } =
        dateRange;

    const [
        grossCurrent,
        collectedCurrent,
        outstandingCurrent,
        refundsCurrent,
        membershipRevenue,
        consultationRevenue,
        radiographRevenue,
        labRevenue,
        dentalLabRevenue,
        manualBillingRevenue,
        revenueChart,
    ] = await Promise.all([
        sumInvoiceFieldInRange(invoices.grandTotal, scope, startDate, endDate),
        sumPaymentsInRange(scope, startDate, endDate),
        sumInvoiceFieldInRange(
            invoices.balanceAmount,
            scope,
            startDate,
            endDate,
            ["pending", "partially_paid"]
        ),
        sumInvoiceFieldInRange(invoices.grandTotal, scope, startDate, endDate, [
            "refunded",
        ]),
        sumInvoiceBySource("membership", scope, startDate, endDate),
        sumInvoiceBySource("consultation", scope, startDate, endDate),
        sumInvoiceBySource("radiograph", scope, startDate, endDate),
        sumInvoiceBySource("lab_request", scope, startDate, endDate),
        sumInvoiceBySource("dental_lab", scope, startDate, endDate),
        sumInvoiceBySource("manual", scope, startDate, endDate),
        buildTimeSeries({
            table: invoices,
            dateColumn: invoices.createdAt,
            valueExpr: invoices.grandTotal,
            scopeClinicColumn: invoices.clinicId,
            scopeClinicId: scope.clinicId,
            extraFilters: [ne(invoices.status, "cancelled")],
            startDate,
            endDate,
            groupBy,
        }),
    ]);

    const previousGross =
        comparisonStartDate && comparisonEndDate
            ? await sumInvoiceFieldInRange(
                  invoices.grandTotal,
                  scope,
                  comparisonStartDate,
                  comparisonEndDate
              )
            : 0;
    const previousCollected =
        comparisonStartDate && comparisonEndDate
            ? await sumPaymentsInRange(
                  scope,
                  comparisonStartDate,
                  comparisonEndDate
              )
            : 0;
    const previousOutstanding =
        comparisonStartDate && comparisonEndDate
            ? await sumInvoiceFieldInRange(
                  invoices.balanceAmount,
                  scope,
                  comparisonStartDate,
                  comparisonEndDate,
                  ["pending", "partially_paid"]
              )
            : 0;
    const previousRefunds =
        comparisonStartDate && comparisonEndDate
            ? await sumInvoiceFieldInRange(
                  invoices.grandTotal,
                  scope,
                  comparisonStartDate,
                  comparisonEndDate,
                  ["refunded"]
              )
            : 0;

    const netCurrent = Math.max(grossCurrent - refundsCurrent, 0);
    const netPrevious = Math.max(previousGross - previousRefunds, 0);

    return {
        filters: filtersApplied,
        grossRevenue: computeGrowthMetric({
            current: grossCurrent,
            previous: previousGross,
        }),
        netRevenue: computeGrowthMetric({
            current: netCurrent,
            previous: netPrevious,
        }),
        collectedRevenue: computeGrowthMetric({
            current: collectedCurrent,
            previous: previousCollected,
        }),
        outstandingRevenue: computeGrowthMetric({
            current: outstandingCurrent,
            previous: previousOutstanding,
        }),
        refunds: computeGrowthMetric({
            current: refundsCurrent,
            previous: previousRefunds,
        }),
        membershipRevenue: computeGrowthMetric({
            current: membershipRevenue,
            previous: 0,
        }),
        consultationRevenue: computeGrowthMetric({
            current: consultationRevenue,
            previous: 0,
        }),
        radiographRevenue: computeGrowthMetric({
            current: radiographRevenue,
            previous: 0,
        }),
        labRevenue: computeGrowthMetric({ current: labRevenue, previous: 0 }),
        dentalLabRevenue: computeGrowthMetric({
            current: dentalLabRevenue,
            previous: 0,
        }),
        manualBillingRevenue: computeGrowthMetric({
            current: manualBillingRevenue,
            previous: 0,
        }),
        revenueChart,
        exportSupportedFormats: ["pdf", "excel", "csv"],
    };
};

export const getPaymentsAnalytics = async (
    filters: AnalyticsFiltersInput
): Promise<PaymentsAnalyticsResponse> => {
    const { dateRange, groupBy, scope, filtersApplied } = resolveFilters(filters);
    const { startDate, endDate } = dateRange;

    const paymentRows = await db
        .select({
            amount: payments.amount,
            method: payments.paymentMethod,
            paymentDate: payments.paymentDate,
        })
        .from(payments)
        .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
        .where(
            and(
                clinicFilter(invoices.clinicId, scope.clinicId),
                dateBetween(payments.paymentDate, startDate, endDate)
            )
        );

    const byMethod = new Map<
        string,
        { collected: number; transactions: number }
    >();
    const byDay = new Map<string, number>();

    for (const row of paymentRows) {
        const key = row.method;
        const current = byMethod.get(key) ?? { collected: 0, transactions: 0 };
        current.collected += Number(row.amount ?? 0);
        current.transactions += 1;
        byMethod.set(key, current);

        const dayLabel = formatBucketLabel(row.paymentDate, "day");
        byDay.set(dayLabel, (byDay.get(dayLabel) ?? 0) + Number(row.amount ?? 0));
    }

    const totalCollected = Array.from(byMethod.values()).reduce(
        (sumValue, v) => sumValue + v.collected,
        0
    );

    const methods = Array.from(byMethod.entries()).map(([method, stats]) => ({
        method,
        collected: stats.collected,
        transactions: stats.transactions,
        percentage:
            totalCollected === 0
                ? 0
                : (stats.collected / totalCollected) * 100,
        averageTicketSize:
            stats.transactions === 0
                ? 0
                : stats.collected / stats.transactions,
    }));

    const outstandingInvoicesCount = await countRows(
        db
            .select({ value: count() })
            .from(invoices)
            .where(
                and(
                    clinicFilter(invoices.clinicId, scope.clinicId),
                    inArray(invoices.status, ["pending", "partially_paid"]),
                    sql`${invoices.balanceAmount} > 0`
                )
            )
    );

    return {
        filters: filtersApplied,
        methods,
        dailyCollectionChart: Array.from(byDay.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([label, value]) => ({ label, value })),
        paymentMethodDistribution: methods.map((m) => ({
            label: m.method,
            value: m.collected,
        })),
        outstandingInvoicesCount,
        pendingPaymentsCount: outstandingInvoicesCount,
        exportSupportedFormats: ["pdf", "excel", "csv"],
    };
};

export const getPatientsAnalytics = async (
    filters: AnalyticsFiltersInput
): Promise<PatientsAnalyticsResponse> => {
    const { dateRange, groupBy, scope, filtersApplied } = resolveFilters(filters);
    const { startDate, endDate, comparisonStartDate, comparisonEndDate } =
        dateRange;

    const [
        totalPatients,
        previousTotal,
        newPatients,
        previousNew,
        returningPatients,
        previousReturning,
        walkIns,
        previousWalkIns,
        registeredToday,
        genderRows,
        clinicRows,
        patientGrowth,
        topVisitRows,
    ] = await Promise.all([
        countPatientsInRange(scope, startDate, endDate),
        comparisonStartDate && comparisonEndDate
            ? countPatientsInRange(scope, comparisonStartDate, comparisonEndDate)
            : Promise.resolve(0),
        countRows(
            db
                .select({ value: count() })
                .from(patients)
                .where(
                    and(
                        clinicFilter(patients.clinicId, scope.clinicId),
                        eq(patients.patientType, "new"),
                        dateBetween(patients.createdAt, startDate, endDate)
                    )
                )
        ),
        comparisonStartDate && comparisonEndDate
            ? countRows(
                  db
                      .select({ value: count() })
                      .from(patients)
                      .where(
                          and(
                              clinicFilter(patients.clinicId, scope.clinicId),
                              eq(patients.patientType, "new"),
                              dateBetween(
                                  patients.createdAt,
                                  comparisonStartDate,
                                  comparisonEndDate
                              )
                          )
                      )
              )
            : Promise.resolve(0),
        countRows(
            db
                .select({ value: count() })
                .from(patients)
                .where(
                    and(
                        clinicFilter(patients.clinicId, scope.clinicId),
                        eq(patients.patientType, "existing"),
                        dateBetween(patients.createdAt, startDate, endDate)
                    )
                )
        ),
        comparisonStartDate && comparisonEndDate
            ? countRows(
                  db
                      .select({ value: count() })
                      .from(patients)
                      .where(
                          and(
                              clinicFilter(patients.clinicId, scope.clinicId),
                              eq(patients.patientType, "existing"),
                              dateBetween(
                                  patients.createdAt,
                                  comparisonStartDate,
                                  comparisonEndDate
                              )
                          )
                      )
              )
            : Promise.resolve(0),
        countRows(
            db
                .select({ value: count() })
                .from(leads)
                .where(
                    and(
                        clinicFilter(leads.clinicId, scope.clinicId),
                        eq(leads.source, "walk_in"),
                        dateBetween(leads.createdAt, startDate, endDate)
                    )
                )
        ),
        comparisonStartDate && comparisonEndDate
            ? countRows(
                  db
                      .select({ value: count() })
                      .from(leads)
                      .where(
                          and(
                              clinicFilter(leads.clinicId, scope.clinicId),
                              eq(leads.source, "walk_in"),
                              dateBetween(
                                  leads.createdAt,
                                  comparisonStartDate,
                                  comparisonEndDate
                              )
                          )
                      )
              )
            : Promise.resolve(0),
        countPatientsInRange(scope, startOfToday(), endOfToday()),
        db
            .select({
                label: patients.gender,
                value: count(),
            })
            .from(patients)
            .where(
                and(
                    clinicFilter(patients.clinicId, scope.clinicId),
                    dateBetween(patients.createdAt, startDate, endDate)
                )
            )
            .groupBy(patients.gender),
        db
            .select({
                label: clinics.clinicName,
                value: count(),
            })
            .from(patients)
            .innerJoin(clinics, eq(patients.clinicId, clinics.id))
            .where(
                and(
                    clinicFilter(patients.clinicId, scope.clinicId),
                    dateBetween(patients.createdAt, startDate, endDate)
                )
            )
            .groupBy(clinics.clinicName),
        buildTimeSeries({
            table: patients,
            dateColumn: patients.createdAt,
            scopeClinicColumn: patients.clinicId,
            scopeClinicId: scope.clinicId,
            startDate,
            endDate,
            groupBy,
        }),
        db
            .select({
                id: patients.id,
                name: patients.name,
                clinicId: patients.clinicId,
                value: count(),
            })
            .from(appointments)
            .innerJoin(patients, eq(appointments.patientId, patients.id))
            .where(
                and(
                    clinicFilter(appointments.clinicId, scope.clinicId),
                    dateBetween(appointments.scheduledAt, startDate, endDate)
                )
            )
            .groupBy(patients.id, patients.name, patients.clinicId)
            .orderBy(desc(count()))
            .limit(10),
    ]);

    const ageRows = await db
        .select({
            dateOfBirth: patients.dateOfBirth,
        })
        .from(patients)
        .where(
            and(
                clinicFilter(patients.clinicId, scope.clinicId),
                dateBetween(patients.createdAt, startDate, endDate)
            )
        );

    const ageBuckets = new Map<string, number>([
        ["0-17", 0],
        ["18-30", 0],
        ["31-45", 0],
        ["46-60", 0],
        ["60+", 0],
    ]);

    const now = new Date();
    for (const row of ageRows) {
        const age =
            now.getFullYear() - new Date(row.dateOfBirth).getFullYear();
        if (age < 18) ageBuckets.set("0-17", (ageBuckets.get("0-17") ?? 0) + 1);
        else if (age <= 30)
            ageBuckets.set("18-30", (ageBuckets.get("18-30") ?? 0) + 1);
        else if (age <= 45)
            ageBuckets.set("31-45", (ageBuckets.get("31-45") ?? 0) + 1);
        else if (age <= 60)
            ageBuckets.set("46-60", (ageBuckets.get("46-60") ?? 0) + 1);
        else ageBuckets.set("60+", (ageBuckets.get("60+") ?? 0) + 1);
    }

    const totalVisits = topVisitRows.reduce(
        (sumValue, row) => sumValue + Number(row.value),
        0
    );

    return {
        filters: filtersApplied,
        totalPatients: computeGrowthMetric({
            current: totalPatients,
            previous: previousTotal,
        }),
        newPatients: computeGrowthMetric({
            current: newPatients,
            previous: previousNew,
        }),
        returningPatients: computeGrowthMetric({
            current: returningPatients,
            previous: previousReturning,
        }),
        walkIns: computeGrowthMetric({
            current: walkIns,
            previous: previousWalkIns,
        }),
        registeredToday,
        patientsByGender: genderRows.map((row) => ({
            label: row.label || "Unknown",
            value: Number(row.value),
        })),
        patientsByAgeGroup: Array.from(ageBuckets.entries()).map(
            ([label, value]) => ({ label, value })
        ),
        patientsByClinic: clinicRows.map((row) => ({
            label: row.label,
            value: Number(row.value),
        })),
        patientsByDoctor: [],
        patientGrowth,
        patientRetention: [],
        patientVisitFrequency: [],
        averageVisits:
            topVisitRows.length === 0 ? 0 : totalVisits / topVisitRows.length,
        topVisitingPatients: topVisitRows.map((row) => ({
            id: row.id,
            name: row.name,
            clinicId: row.clinicId,
            value: Number(row.value),
            metric: "appointments",
        })),
        exportSupportedFormats: ["pdf", "excel", "csv"],
    };
};

export const getLeadsAnalytics = async (
    filters: AnalyticsFiltersInput
): Promise<LeadsAnalyticsResponse> => {
    const { dateRange, groupBy, scope, filtersApplied } = resolveFilters(filters);
    const { startDate, endDate, comparisonStartDate, comparisonEndDate } =
        dateRange;

    const [
        totalLeads,
        previousTotal,
        newLeads,
        previousNew,
        convertedLeads,
        previousConverted,
        lostLeads,
        previousLost,
        pendingLeads,
        previousPending,
        sourceRows,
        statusRows,
        leadTrend,
    ] = await Promise.all([
        countLeadsInRange(scope, startDate, endDate),
        comparisonStartDate && comparisonEndDate
            ? countLeadsInRange(scope, comparisonStartDate, comparisonEndDate)
            : Promise.resolve(0),
        countLeadsInRange(scope, startDate, endDate, "new_query"),
        comparisonStartDate && comparisonEndDate
            ? countLeadsInRange(
                  scope,
                  comparisonStartDate,
                  comparisonEndDate,
                  "new_query"
              )
            : Promise.resolve(0),
        countLeadsInRange(scope, startDate, endDate, [
            "converted",
            "clinic_visited",
        ]),
        comparisonStartDate && comparisonEndDate
            ? countLeadsInRange(
                  scope,
                  comparisonStartDate,
                  comparisonEndDate,
                  ["converted", "clinic_visited"]
              )
            : Promise.resolve(0),
        countLeadsInRange(scope, startDate, endDate, "closed_lost"),
        comparisonStartDate && comparisonEndDate
            ? countLeadsInRange(
                  scope,
                  comparisonStartDate,
                  comparisonEndDate,
                  "closed_lost"
              )
            : Promise.resolve(0),
        countLeadsInRange(scope, startDate, endDate, [
            "new_query",
            "follow_up",
            "appointment_booked",
        ]),
        comparisonStartDate && comparisonEndDate
            ? countLeadsInRange(
                  scope,
                  comparisonStartDate,
                  comparisonEndDate,
                  ["new_query", "follow_up", "appointment_booked"]
              )
            : Promise.resolve(0),
        db
            .select({
                label: leads.source,
                value: count(),
            })
            .from(leads)
            .where(
                and(
                    clinicFilter(leads.clinicId, scope.clinicId),
                    dateBetween(leads.createdAt, startDate, endDate)
                )
            )
            .groupBy(leads.source),
        db
            .select({
                label: leads.status,
                value: count(),
            })
            .from(leads)
            .where(
                and(
                    clinicFilter(leads.clinicId, scope.clinicId),
                    dateBetween(leads.createdAt, startDate, endDate)
                )
            )
            .groupBy(leads.status),
        buildTimeSeries({
            table: leads,
            dateColumn: leads.createdAt,
            scopeClinicColumn: leads.clinicId,
            scopeClinicId: scope.clinicId,
            startDate,
            endDate,
            groupBy,
        }),
    ]);

    const conversionRateCurrent =
        totalLeads === 0 ? 0 : (convertedLeads / totalLeads) * 100;
    const conversionRatePrevious =
        previousTotal === 0 ? 0 : (previousConverted / previousTotal) * 100;

    return {
        filters: filtersApplied,
        totalLeads: computeGrowthMetric({
            current: totalLeads,
            previous: previousTotal,
        }),
        newLeads: computeGrowthMetric({
            current: newLeads,
            previous: previousNew,
        }),
        convertedLeads: computeGrowthMetric({
            current: convertedLeads,
            previous: previousConverted,
        }),
        lostLeads: computeGrowthMetric({
            current: lostLeads,
            previous: previousLost,
        }),
        pendingLeads: computeGrowthMetric({
            current: pendingLeads,
            previous: previousPending,
        }),
        conversionRate: computeGrowthMetric({
            current: conversionRateCurrent,
            previous: conversionRatePrevious,
        }),
        averageConversionTime: 0,
        leadSources: sourceRows.map((row) => ({
            label: row.label,
            value: Number(row.value),
        })),
        leadFunnel: statusRows.map((row) => ({
            label: row.label,
            value: Number(row.value),
        })),
        leadTrend,
        exportSupportedFormats: ["pdf", "excel", "csv"],
    };
};

export const getAppointmentsAnalytics = async (
    filters: AnalyticsFiltersInput
): Promise<AppointmentsAnalyticsResponse> => {
    const { dateRange, groupBy, scope, filtersApplied } = resolveFilters(filters);
    const { startDate, endDate, comparisonStartDate, comparisonEndDate } =
        dateRange;

    const [
        scheduled,
        previousScheduled,
        completed,
        previousCompleted,
        cancelled,
        previousCancelled,
        noShow,
        previousNoShow,
        todaysAppointments,
        durationRow,
        doctorRows,
        appointmentTrend,
        peakHourRows,
        clinicRows,
    ] = await Promise.all([
        countAppointmentsInRange(scope, startDate, endDate),
        comparisonStartDate && comparisonEndDate
            ? countAppointmentsInRange(
                  scope,
                  comparisonStartDate,
                  comparisonEndDate
              )
            : Promise.resolve(0),
        countAppointmentsInRange(scope, startDate, endDate, "completed"),
        comparisonStartDate && comparisonEndDate
            ? countAppointmentsInRange(
                  scope,
                  comparisonStartDate,
                  comparisonEndDate,
                  "completed"
              )
            : Promise.resolve(0),
        countAppointmentsInRange(scope, startDate, endDate, "cancelled"),
        comparisonStartDate && comparisonEndDate
            ? countAppointmentsInRange(
                  scope,
                  comparisonStartDate,
                  comparisonEndDate,
                  "cancelled"
              )
            : Promise.resolve(0),
        countAppointmentsInRange(scope, startDate, endDate, "no_show"),
        comparisonStartDate && comparisonEndDate
            ? countAppointmentsInRange(
                  scope,
                  comparisonStartDate,
                  comparisonEndDate,
                  "no_show"
              )
            : Promise.resolve(0),
        countAppointmentsInRange(scope, startOfToday(), endOfToday()),
        db
            .select({
                value: sql<number>`coalesce(avg(${appointments.durationMinutes}), 0)`,
            })
            .from(appointments)
            .where(
                and(
                    clinicFilter(appointments.clinicId, scope.clinicId),
                    doctorAppointmentFilter(scope.doctorId),
                    dateBetween(appointments.scheduledAt, startDate, endDate)
                )
            ),
        db
            .select({
                label: employees.name,
                value: count(),
            })
            .from(appointments)
            .innerJoin(employees, eq(appointments.employeeId, employees.id))
            .where(
                and(
                    clinicFilter(appointments.clinicId, scope.clinicId),
                    doctorAppointmentFilter(scope.doctorId),
                    dateBetween(appointments.scheduledAt, startDate, endDate)
                )
            )
            .groupBy(employees.name)
            .orderBy(desc(count()))
            .limit(10),
        buildTimeSeries({
            table: appointments,
            dateColumn: appointments.scheduledAt,
            scopeClinicColumn: appointments.clinicId,
            scopeClinicId: scope.clinicId,
            extraFilters: scope.doctorId
                ? [eq(appointments.employeeId, scope.doctorId)]
                : [],
            startDate,
            endDate,
            groupBy,
        }),
        db
            .select({
                label: sql<string>`to_char(${appointments.scheduledAt}, 'HH24')`,
                value: count(),
            })
            .from(appointments)
            .where(
                and(
                    clinicFilter(appointments.clinicId, scope.clinicId),
                    doctorAppointmentFilter(scope.doctorId),
                    dateBetween(appointments.scheduledAt, startDate, endDate)
                )
            )
            .groupBy(sql`to_char(${appointments.scheduledAt}, 'HH24')`)
            .orderBy(sql`to_char(${appointments.scheduledAt}, 'HH24')`),
        db
            .select({
                label: clinics.clinicName,
                value: count(),
            })
            .from(appointments)
            .innerJoin(clinics, eq(appointments.clinicId, clinics.id))
            .where(
                and(
                    clinicFilter(appointments.clinicId, scope.clinicId),
                    doctorAppointmentFilter(scope.doctorId),
                    dateBetween(appointments.scheduledAt, startDate, endDate)
                )
            )
            .groupBy(clinics.clinicName),
    ]);

    return {
        filters: filtersApplied,
        scheduled: computeGrowthMetric({
            current: scheduled,
            previous: previousScheduled,
        }),
        completed: computeGrowthMetric({
            current: completed,
            previous: previousCompleted,
        }),
        cancelled: computeGrowthMetric({
            current: cancelled,
            previous: previousCancelled,
        }),
        noShow: computeGrowthMetric({
            current: noShow,
            previous: previousNoShow,
        }),
        rescheduled: computeGrowthMetric({ current: 0, previous: 0 }),
        todaysAppointments,
        averageAppointmentDuration: Number(durationRow[0]?.value ?? 0),
        doctorUtilization: doctorRows.map((row) => ({
            label: row.label,
            value: Number(row.value),
        })),
        appointmentTrend,
        peakHours: peakHourRows.map((row) => ({
            label: `${row.label}:00`,
            value: Number(row.value),
        })),
        appointmentSources: [],
        clinicDistribution: clinicRows.map((row) => ({
            label: row.label,
            value: Number(row.value),
        })),
        exportSupportedFormats: ["pdf", "excel", "csv"],
    };
};

export const getAlertsAnalytics = async (
    filters: AnalyticsFiltersInput
): Promise<AlertsAnalyticsResponse> => {
    const { scope, filtersApplied } = resolveFilters(filters);
    const alerts = await getAlerts(scope);

    return {
        filters: filtersApplied,
        alerts,
        exportSupportedFormats: ["pdf", "excel", "csv"],
    };
};
