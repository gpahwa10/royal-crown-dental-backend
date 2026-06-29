export const LAB_REQUEST_STATUSES = [
    "sample_collected",
    "under_examination",
    "delivered",
] as const;

export const LAB_REQUEST_CODE_PREFIX = "LAB";
export const LAB_REQUEST_CODE_PAD_LENGTH = 6;

export type LabRequestStatus = (typeof LAB_REQUEST_STATUSES)[number];
