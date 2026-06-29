export const CONSULTATION_STATUSES = [
    "draft",
    "in_progress",
    "completed",
    "cancelled",
] as const;

export const CONSULTATION_CODE_PREFIX = "CON";
export const CONSULTATION_CODE_PAD_LENGTH = 6;

export type ConsultationStatus = (typeof CONSULTATION_STATUSES)[number];
