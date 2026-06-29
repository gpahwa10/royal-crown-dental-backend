export const CLINIC_VISIT_PURPOSES = [
    "consultation",
    "treatment",
    "follow_up",
    "enquiry",
    "emergency",
    "billing",
    "membership",
    "report_collection",
    "medicine_collection",
    "document_submission",
    "other",
] as const;

export const CLINIC_VISIT_OUTCOMES = [
    "enquiry_only",
    "appointment_booked",
    "patient_registered",
    "consultation_completed",
    "treatment_started",
    "treatment_completed",
    "billing_completed",
    "membership_purchased",
    "reports_collected",
    "cancelled",
    "left_without_consultation",
    "referred",
    "other",
] as const;

export const CLINIC_VISIT_STATUSES = [
    "checked_in",
    "in_progress",
    "completed",
    "cancelled",
] as const;

export const CLINIC_VISIT_NUMBER_PREFIX = "CV";
export const CLINIC_VISIT_NUMBER_PAD_LENGTH = 6;

export const ACTIVE_CLINIC_VISIT_STATUSES = [
    "checked_in",
    "in_progress",
] as const;

export type ClinicVisitPurpose = (typeof CLINIC_VISIT_PURPOSES)[number];
export type ClinicVisitOutcome = (typeof CLINIC_VISIT_OUTCOMES)[number];
export type ClinicVisitStatus = (typeof CLINIC_VISIT_STATUSES)[number];
