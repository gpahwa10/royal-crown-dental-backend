import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "../../db/client";
import { invoices } from "../../db/schema/invoices";
import { payments } from "../../db/schema/payments";
import { patients } from "../../db/schema/patients";
import { leads } from "../../db/schema/leads";
import { appointments } from "../../db/schema/appointments";
import {
    AlertsAnalyticsResponse,
    AppointmentsAnalyticsResponse,
    DashboardSummary,
    LeadsAnalyticsResponse,
    PatientsAnalyticsResponse,
    PaymentsAnalyticsResponse,
    RevenueAnalyticsResponse,
} from "./analytics.types";
import {
    AnalyticsFiltersInput,
    comparisonPeriodEnum,
} from "./analytics.validation";
import {
    computeGrowthMetric,
    inferGroupByUnit,
    resolveDateRange,
    resolveEffectiveScope,
} from "./analytics.utils";

const buildDateFilter = (
    column: any,
    range: {
        startDate: Date;
        endDate: Date;
    }
) => and(gte(column, range.startDate), lte(column, range.endDate));

export const getDashboardAnalytics = async (
    filters: AnalyticsFiltersInput
): Promise<DashboardSummary> => {
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

    const kpis: DashboardSummary["kpis"] = {};

    const patientCurrentCount = await db
        .select({ value: patients.id })
        .from(patients)
        .where(
            and(
                scope.clinicId ? eq(patients.clinicId, scope.clinicId) : undefined,
                buildDateFilter(patients.createdAt, dateRange)
            )
        );

    const patientPreviousCount =
        dateRange.comparisonStartDate && dateRange.comparisonEndDate
            ? await db
                  .select({ value: patients.id })
                  .from(patients)
                  .where(
                      and(
                          scope.clinicId
                              ? eq(patients.clinicId, scope.clinicId)
                              : undefined,
                          buildDateFilter(patients.createdAt, {
                              startDate: dateRange.comparisonStartDate,
                              endDate: dateRange.comparisonEndDate,
                          })
                      )
                  )
            : [];

    kpis["patients"] = computeGrowthMetric({
        current: patientCurrentCount.length,
        previous: patientPreviousCount.length,
    });

    const appointmentsTodayCount = await db
        .select({ value: appointments.id })
        .from(appointments)
        .where(
            scope.clinicId
                ? eq(appointments.clinicId, scope.clinicId)
                : undefined
        );

    kpis["appointmentsToday"] = appointmentsTodayCount.length;

    const filtersApplied = {
        clinicId: scope.clinicId,
        doctorId: scope.doctorId,
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        comparisonPeriod: filters.comparisonPeriod,
        groupBy,
    };

    return {
        filters: filtersApplied,
        kpis,
        charts: {},
        alerts: [],
        topDoctors: [],
        topClinics: [],
        topTreatments: [],
        topMembershipPlans: [],
        recentActivities: [],
        quickStats: {},
        exportSupportedFormats: ["pdf", "excel", "csv"],
    };
};

export const getRevenueAnalytics = async (
    filters: AnalyticsFiltersInput
): Promise<RevenueAnalyticsResponse> => {
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

    const invoiceFilter = and(
        scope.clinicId ? eq(invoices.clinicId, scope.clinicId) : undefined,
        buildDateFilter(invoices.createdAt, dateRange)
    );

    const [invoiceSum] = await db
        .select({
            total: invoices.grandTotal,
        })
        .from(invoices)
        .where(invoiceFilter)
        .limit(1);

    const currentGross = Number(invoiceSum?.total ?? 0);

    const previousGross =
        dateRange.comparisonStartDate && dateRange.comparisonEndDate
            ? Number(
                  (
                      await db
                          .select({ total: invoices.grandTotal })
                          .from(invoices)
                          .where(
                              and(
                                  scope.clinicId
                                      ? eq(invoices.clinicId, scope.clinicId)
                                      : undefined,
                                  buildDateFilter(invoices.createdAt, {
                                      startDate: dateRange.comparisonStartDate,
                                      endDate: dateRange.comparisonEndDate,
                                  })
                              )
                          )
                          .limit(1)
                  )[0]?.total ?? 0
              )
            : 0;

    const grossRevenue = computeGrowthMetric({
        current: currentGross,
        previous: previousGross,
    });

    const filtersApplied = {
        clinicId: scope.clinicId,
        doctorId: scope.doctorId,
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        comparisonPeriod: filters.comparisonPeriod,
        groupBy,
    };

    return {
        filters: filtersApplied,
        grossRevenue,
        netRevenue: computeGrowthMetric({ current: 0, previous: 0 }),
        collectedRevenue: computeGrowthMetric({ current: 0, previous: 0 }),
        outstandingRevenue: computeGrowthMetric({ current: 0, previous: 0 }),
        refunds: computeGrowthMetric({ current: 0, previous: 0 }),
        membershipRevenue: computeGrowthMetric({ current: 0, previous: 0 }),
        consultationRevenue: computeGrowthMetric({ current: 0, previous: 0 }),
        radiographRevenue: computeGrowthMetric({ current: 0, previous: 0 }),
        labRevenue: computeGrowthMetric({ current: 0, previous: 0 }),
        dentalLabRevenue: computeGrowthMetric({ current: 0, previous: 0 }),
        manualBillingRevenue: computeGrowthMetric({ current: 0, previous: 0 }),
        revenueChart: [],
        exportSupportedFormats: ["pdf", "excel", "csv"],
    };
};

export const getPaymentsAnalytics = async (
    filters: AnalyticsFiltersInput
): Promise<PaymentsAnalyticsResponse> => {
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

    const paymentFilter = buildDateFilter(payments.paymentDate, dateRange);

    const paymentsRows = await db
        .select({
            amount: payments.amount,
            method: payments.paymentMethod,
        })
        .from(payments)
        .where(paymentFilter);

    const byMethod = new Map<
        string,
        { collected: number; transactions: number }
    >();

    for (const row of paymentsRows) {
        const key = row.method;
        const current = byMethod.get(key) ?? { collected: 0, transactions: 0 };
        current.collected += Number(row.amount ?? 0);
        current.transactions += 1;
        byMethod.set(key, current);
    }

    const totalCollected = Array.from(byMethod.values()).reduce(
        (sum, v) => sum + v.collected,
        0
    );

    const methods = Array.from(byMethod.entries()).map(
        ([method, stats]) => ({
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
        })
    );

    const filtersApplied = {
        clinicId: scope.clinicId,
        doctorId: scope.doctorId,
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        comparisonPeriod: filters.comparisonPeriod,
        groupBy,
    };

    return {
        filters: filtersApplied,
        methods,
        dailyCollectionChart: [],
        paymentMethodDistribution: methods.map((m) => ({
            label: m.method,
            value: m.collected,
        })),
        outstandingInvoicesCount: 0,
        pendingPaymentsCount: 0,
        exportSupportedFormats: ["pdf", "excel", "csv"],
    };
};

export const getPatientsAnalytics = async (
    filters: AnalyticsFiltersInput
): Promise<PatientsAnalyticsResponse> => {
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

    const baseFilter = and(
        scope.clinicId ? eq(patients.clinicId, scope.clinicId) : undefined,
        buildDateFilter(patients.createdAt, dateRange)
    );

    const currentPatients = await db
        .select({ id: patients.id })
        .from(patients)
        .where(baseFilter);

    const previousPatients =
        dateRange.comparisonStartDate && dateRange.comparisonEndDate
            ? await db
                  .select({ id: patients.id })
                  .from(patients)
                  .where(
                      and(
                          scope.clinicId
                              ? eq(patients.clinicId, scope.clinicId)
                              : undefined,
                          buildDateFilter(patients.createdAt, {
                              startDate: dateRange.comparisonStartDate,
                              endDate: dateRange.comparisonEndDate,
                          })
                      )
                  )
            : [];

    const filtersApplied = {
        clinicId: scope.clinicId,
        doctorId: scope.doctorId,
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        comparisonPeriod: filters.comparisonPeriod,
        groupBy,
    };

    return {
        filters: filtersApplied,
        totalPatients: computeGrowthMetric({
            current: currentPatients.length,
            previous: previousPatients.length,
        }),
        newPatients: computeGrowthMetric({ current: 0, previous: 0 }),
        returningPatients: computeGrowthMetric({ current: 0, previous: 0 }),
        walkIns: computeGrowthMetric({ current: 0, previous: 0 }),
        registeredToday: 0,
        patientsByGender: [],
        patientsByAgeGroup: [],
        patientsByClinic: [],
        patientsByDoctor: [],
        patientGrowth: [],
        patientRetention: [],
        patientVisitFrequency: [],
        averageVisits: 0,
        topVisitingPatients: [],
        exportSupportedFormats: ["pdf", "excel", "csv"],
    };
};

export const getLeadsAnalytics = async (
    filters: AnalyticsFiltersInput
): Promise<LeadsAnalyticsResponse> => {
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

    const baseFilter = and(
        scope.clinicId ? eq(leads.clinicId, scope.clinicId) : undefined,
        buildDateFilter(leads.createdAt, dateRange)
    );

    const currentLeads = await db
        .select({ id: leads.id })
        .from(leads)
        .where(baseFilter);

    const previousLeads =
        dateRange.comparisonStartDate && dateRange.comparisonEndDate
            ? await db
                  .select({ id: leads.id })
                  .from(leads)
                  .where(
                      and(
                          scope.clinicId
                              ? eq(leads.clinicId, scope.clinicId)
                              : undefined,
                          buildDateFilter(leads.createdAt, {
                              startDate: dateRange.comparisonStartDate,
                              endDate: dateRange.comparisonEndDate,
                          })
                      )
                  )
            : [];

    const filtersApplied = {
        clinicId: scope.clinicId,
        doctorId: scope.doctorId,
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        comparisonPeriod: filters.comparisonPeriod,
        groupBy,
    };

    return {
        filters: filtersApplied,
        totalLeads: computeGrowthMetric({
            current: currentLeads.length,
            previous: previousLeads.length,
        }),
        newLeads: computeGrowthMetric({ current: 0, previous: 0 }),
        convertedLeads: computeGrowthMetric({ current: 0, previous: 0 }),
        lostLeads: computeGrowthMetric({ current: 0, previous: 0 }),
        pendingLeads: computeGrowthMetric({ current: 0, previous: 0 }),
        conversionRate: computeGrowthMetric({ current: 0, previous: 0 }),
        averageConversionTime: 0,
        leadSources: [],
        leadFunnel: [],
        leadTrend: [],
        exportSupportedFormats: ["pdf", "excel", "csv"],
    };
};

export const getAppointmentsAnalytics = async (
    filters: AnalyticsFiltersInput
): Promise<AppointmentsAnalyticsResponse> => {
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

    const baseFilter = and(
        scope.clinicId
            ? eq(appointments.clinicId, scope.clinicId)
            : undefined,
        buildDateFilter(appointments.scheduledAt, dateRange)
    );

    const currentAppointments = await db
        .select({ id: appointments.id })
        .from(appointments)
        .where(baseFilter);

    const filtersApplied = {
        clinicId: scope.clinicId,
        doctorId: scope.doctorId,
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        comparisonPeriod: filters.comparisonPeriod,
        groupBy,
    };

    return {
        filters: filtersApplied,
        scheduled: computeGrowthMetric({
            current: currentAppointments.length,
            previous: 0,
        }),
        completed: computeGrowthMetric({ current: 0, previous: 0 }),
        cancelled: computeGrowthMetric({ current: 0, previous: 0 }),
        noShow: computeGrowthMetric({ current: 0, previous: 0 }),
        rescheduled: computeGrowthMetric({ current: 0, previous: 0 }),
        todaysAppointments: 0,
        averageAppointmentDuration: 0,
        doctorUtilization: [],
        appointmentTrend: [],
        peakHours: [],
        appointmentSources: [],
        clinicDistribution: [],
        exportSupportedFormats: ["pdf", "excel", "csv"],
    };
};

export const getAlertsAnalytics = async (
    filters: AnalyticsFiltersInput
): Promise<AlertsAnalyticsResponse> => {
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

    const filtersApplied = {
        clinicId: scope.clinicId,
        doctorId: scope.doctorId,
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        comparisonPeriod: filters.comparisonPeriod,
        groupBy,
    };

    return {
        filters: filtersApplied,
        alerts: [],
        exportSupportedFormats: ["pdf", "excel", "csv"],
    };
};

