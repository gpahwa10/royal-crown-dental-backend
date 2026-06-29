export const FILE_DOCUMENT_TYPES = [
    "lab_report",
    "radiograph",
    "prescription",
    "invoice",
    "consent",
    "treatment",
    "patient_document",
    "other",
] as const;

export const FILE_UPLOAD_STATUSES = [
    "pending_upload",
    "uploaded",
    "archived",
] as const;

export const ALLOWED_CONTENT_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/tiff",
    "application/dicom",
    "application/octet-stream",
] as const;

export const MAX_UPLOAD_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export type FileDocumentType = (typeof FILE_DOCUMENT_TYPES)[number];
export type FileUploadStatus = (typeof FILE_UPLOAD_STATUSES)[number];
