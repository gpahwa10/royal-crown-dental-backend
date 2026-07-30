export type GroupByUnit = "day" | "week" | "month" | "quarter" | "year";

export type ComparisonPeriod = "previous_period" | "previous_year" | "none";

export interface DateRangeInfo {
    startDate: Date;
    endDate: Date;
    comparisonStartDate?: Date;
    comparisonEndDate?: Date;
    groupBy?: GroupByUnit;
}

export interface GrowthMetric {
    current: number;
    previous: number;
    difference: number;
    percentage: number;
}

export interface ChartPoint {
    label: string;
    value: number;
}

export interface AnalyticsFiltersApplied {
    clinicId?: string;
    doctorId?: string;
    startDate: string;
    endDate: string;
    comparisonPeriod: ComparisonPeriod;
    groupBy?: GroupByUnit;
}

export type AlertType =
    | "low_inventory"
    | "pending_lab_reports"
    | "pending_radiographs"
    | "pending_dental_lab_orders"
    | "delayed_dental_lab_orders"
    | "outstanding_payments"
    | "expiring_memberships"
    | "expired_memberships"
    | "no_show_patients"
    | "cancelled_appointments"
    | "pending_follow_ups"
    | "overdue_invoices";

export interface AlertItem {
    type: AlertType;
    label: string;
    severity: "info" | "warning" | "critical";
    count: number;
    meta?: Record<string, unknown>;
}

export type RecentActivityType =
    | "patient_registered"
    | "lead_created"
    | "consultation_completed"
    | "invoice_generated"
    | "payment_received"
    | "membership_purchased"
    | "lab_request_created"
    | "radiograph_reported"
    | "dental_lab_delivered";

export interface RecentActivityItem {
    type: RecentActivityType;
    id: string;
    clinicId?: string | null;
    patientId?: string | null;
    label: string;
    occurredAt: string;
    meta?: Record<string, unknown>;
}

export interface TopPerformerItem {
    id: string;
    name: string;
    clinicId?: string | null;
    value: number;
    metric: string;
}

export interface DashboardSummary {
    filters: AnalyticsFiltersApplied;
    kpis: Record<string, GrowthMetric | number>;
    charts: {
        revenue?: ChartPoint[];
        appointments?: ChartPoint[];
        patients?: ChartPoint[];
        leads?: ChartPoint[];
        memberships?: ChartPoint[];
        payments?: ChartPoint[];
    };
    alerts: AlertItem[];
    topDoctors: TopPerformerItem[];
    topClinics: TopPerformerItem[];
    topTreatments: TopPerformerItem[];
    topMembershipPlans: TopPerformerItem[];
    recentActivities: RecentActivityItem[];
    quickStats: Record<string, number>;
    exportSupportedFormats: ("pdf" | "excel" | "csv")[];
}

export interface RevenueAnalyticsResponse {
    filters: AnalyticsFiltersApplied;
    grossRevenue: GrowthMetric;
    netRevenue: GrowthMetric;
    collectedRevenue: GrowthMetric;
    outstandingRevenue: GrowthMetric;
    refunds: GrowthMetric;
    membershipRevenue: GrowthMetric;
    consultationRevenue: GrowthMetric;
    radiographRevenue: GrowthMetric;
    labRevenue: GrowthMetric;
    dentalLabRevenue: GrowthMetric;
    manualBillingRevenue: GrowthMetric;
    revenueChart: ChartPoint[];
    exportSupportedFormats: ("pdf" | "excel" | "csv")[];
}

export interface PaymentsMethodBreakdownItem {
    method: string;
    collected: number;
    transactions: number;
    percentage: number;
    averageTicketSize: number;
}

export interface PaymentsAnalyticsResponse {
    filters: AnalyticsFiltersApplied;
    methods: PaymentsMethodBreakdownItem[];
    dailyCollectionChart: ChartPoint[];
    paymentMethodDistribution: ChartPoint[];
    outstandingInvoicesCount: number;
    pendingPaymentsCount: number;
    exportSupportedFormats: ("pdf" | "excel" | "csv")[];
}

export interface PatientsAnalyticsResponse {
    filters: AnalyticsFiltersApplied;
    totalPatients: GrowthMetric;
    newPatients: GrowthMetric;
    returningPatients: GrowthMetric;
    walkIns: GrowthMetric;
    registeredToday: number;
    patientsByGender: ChartPoint[];
    patientsByAgeGroup: ChartPoint[];
    patientsByClinic: ChartPoint[];
    patientsByDoctor: ChartPoint[];
    patientGrowth: ChartPoint[];
    patientRetention: ChartPoint[];
    patientVisitFrequency: ChartPoint[];
    averageVisits: number;
    topVisitingPatients: TopPerformerItem[];
    exportSupportedFormats: ("pdf" | "excel" | "csv")[];
}

export interface LeadsAnalyticsResponse {
    filters: AnalyticsFiltersApplied;
    totalLeads: GrowthMetric;
    newLeads: GrowthMetric;
    convertedLeads: GrowthMetric;
    lostLeads: GrowthMetric;
    pendingLeads: GrowthMetric;
    conversionRate: GrowthMetric;
    averageConversionTime: number;
    leadSources: ChartPoint[];
    leadFunnel: ChartPoint[];
    leadTrend: ChartPoint[];
    exportSupportedFormats: ("pdf" | "excel" | "csv")[];
}

export interface AppointmentsAnalyticsResponse {
    filters: AnalyticsFiltersApplied;
    scheduled: GrowthMetric;
    completed: GrowthMetric;
    cancelled: GrowthMetric;
    noShow: GrowthMetric;
    rescheduled: GrowthMetric;
    todaysAppointments: number;
    averageAppointmentDuration: number;
    doctorUtilization: ChartPoint[];
    appointmentTrend: ChartPoint[];
    peakHours: ChartPoint[];
    appointmentSources: ChartPoint[];
    clinicDistribution: ChartPoint[];
    exportSupportedFormats: ("pdf" | "excel" | "csv")[];
}

export interface AlertsAnalyticsResponse {
    filters: AnalyticsFiltersApplied;
    alerts: AlertItem[];
    exportSupportedFormats: ("pdf" | "excel" | "csv")[];
}

