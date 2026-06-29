export const PATIENT_TYPES = ["new", "existing"] as const;

export const PREGNANCY_STATUSES = [
    "Not Applicable",
    "Pregnant",
    "Not Pregnant",
] as const;

export const DENTAL_ANXIETY_LEVELS = [
    "none",
    "mild",
    "moderate",
    "severe",
] as const;

export const PATIENT_CODE_PREFIX = "PAT";
export const PATIENT_CODE_PAD_LENGTH = 6;

export type PatientType = (typeof PATIENT_TYPES)[number];
export type PregnancyStatus = (typeof PREGNANCY_STATUSES)[number];
export type DentalAnxietyLevel = (typeof DENTAL_ANXIETY_LEVELS)[number];
