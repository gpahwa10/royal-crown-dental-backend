export const LEAD_SOURCES = [
    "call",
    "whatsapp",
    "website",
    "walk_in",
    "referral",
    "qr_self",
] as const;

export const LEAD_STATUSES = [
    "new_query",
    "follow_up",
    "appointment_booked",
    "clinic_visited",
    "converted",
    "closed_lost",
    "no_show",
] as const;

export const TERMINAL_LEAD_STATUSES = ["clinic_visited", "no_show"] as const;

/** Active pipeline statuses — duplicate create requests reuse the existing row. */
export const OPEN_LEAD_STATUSES = [
    "new_query",
    "follow_up",
    "appointment_booked",
] as const;

export const APPOINTMENT_STATUSES = [
    "scheduled",
    "checked_in",
    "in_progress",
    "completed",
    "cancelled",
    "no_show",
] as const;

export const PUBLIC_INTAKE_DEFAULT_NOTES =
    "Imported from public self-check-in.";

export type LeadSource = (typeof LEAD_SOURCES)[number];
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
