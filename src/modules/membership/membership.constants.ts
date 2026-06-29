export const MEMBERSHIP_DISCOUNT_TYPES = [
    "percentage",
    "fixed",
    "free",
] as const;

export const PATIENT_MEMBERSHIP_STATUSES = [
    "pending_payment",
    "active",
    "expired",
    "cancelled",
] as const;

export type MembershipDiscountType =
    (typeof MEMBERSHIP_DISCOUNT_TYPES)[number];
export type PatientMembershipStatus =
    (typeof PATIENT_MEMBERSHIP_STATUSES)[number];
