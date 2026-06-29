export const TRANSACTION_TYPES = {
    PURCHASE: "purchase",
    TRANSFER: "transfer",
    USAGE: "usage",
    ADJUSTMENT: "adjustment",
    DAMAGED: "damaged",
    EXPIRED: "expired",
    RETURN: "return",
} as const;

export type TransactionType =
    (typeof TRANSACTION_TYPES)[keyof typeof TRANSACTION_TYPES];

export const LOCATION_TYPES = {
    CLINIC: "clinic",
    WAREHOUSE: "warehouse",
} as const;

export type LocationType =
    (typeof LOCATION_TYPES)[keyof typeof LOCATION_TYPES];
