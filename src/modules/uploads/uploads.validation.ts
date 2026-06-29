import { z } from "zod";
import {
    ALLOWED_CONTENT_TYPES,
    FILE_DOCUMENT_TYPES,
    FILE_UPLOAD_STATUSES,
    MAX_UPLOAD_FILE_SIZE_BYTES,
} from "./uploads.constants";

export const fileIdParamSchema = z.object({
    id: z.uuid(),
});

export const patientIdParamSchema = z.object({
    patientId: z.uuid(),
});

export const presignUploadSchema = z.object({
    patientId: z.uuid(),
    documentType: z.enum(FILE_DOCUMENT_TYPES),
    fileName: z.string().trim().min(1).max(255),
    contentType: z.enum(ALLOWED_CONTENT_TYPES),
    fileSize: z
        .number()
        .int()
        .positive()
        .max(MAX_UPLOAD_FILE_SIZE_BYTES)
        .optional(),
});

export const registerUploadSchema = z.object({
    fileSize: z
        .number()
        .int()
        .positive()
        .max(MAX_UPLOAD_FILE_SIZE_BYTES)
        .optional(),
});

export const patientUploadListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    documentType: z.enum(FILE_DOCUMENT_TYPES).optional(),
    status: z.enum(FILE_UPLOAD_STATUSES).optional(),
});
