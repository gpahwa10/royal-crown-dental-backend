export const DENTAL_LAB_ORDER_STATUSES = [
    "ordered",
    "delivered",
    "cementation_done",
] as const;

export const DENTAL_LAB_ITEM_TYPES = [
    "crown",
    "bridge",
    "veneer",
    "denture",
    "implant_crown",
    "night_guard",
    "orthodontic_retainer",
    "custom_abutment",
    "impression_tray",
] as const;

export const DENTAL_LAB_ORDER_CODE_PREFIX = "DL";
export const DENTAL_LAB_ORDER_CODE_PAD_LENGTH = 6;

export type DentalLabOrderStatus = (typeof DENTAL_LAB_ORDER_STATUSES)[number];
export type DentalLabItemType = (typeof DENTAL_LAB_ITEM_TYPES)[number];
