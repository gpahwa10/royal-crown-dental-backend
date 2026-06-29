export const APPOINTMENT_STATUSES = [
    "scheduled",
    "checked_in",
    "in_progress",
    "completed",
    "cancelled",
    "no_show",
] as const;

export const APPOINTMENT_TYPES = [
    "general",
    "consultation",
    "treatment",
    "follow_up",
] as const;

export const APPOINTMENT_CODE_PREFIX = "APT";
export const APPOINTMENT_CODE_PAD_LENGTH = 6;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export type AppointmentType = (typeof APPOINTMENT_TYPES)[number];
