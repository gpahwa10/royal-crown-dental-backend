import { z } from "zod";
import { LAB_REQUEST_STATUSES } from "./labRequests.constants";

export const labRequestIdParamSchema = z.object({
    id: z.uuid(),
});

export const patientIdParamSchema = z.object({
    patientId: z.uuid(),
});

export const createLabRequestSchema = z.object({
    patientId: z.uuid(),
    doctorId: z.uuid(),
    clinicId: z.uuid().optional(),
    consultationId: z.uuid().nullable().optional(),
    externalLabName: z.string().trim().optional(),
    tests: z.array(z.string().trim().min(1)).min(1, {
        message: "At least one test required",
    }),
    notes: z.string().trim().optional(),
});

export const moveToExaminationSchema = z
    .object({})
    .strict()
    .optional()
    .default({});

export const deliverLabRequestSchema = z
    .object({})
    .strict()
    .optional()
    .default({});

export const uploadLabReportSchema = z.object({
    fileId: z.uuid(),
    reportName: z.string().trim().min(1).optional(),
});

export const labRequestListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().optional(),
    clinicId: z.uuid().optional(),
    doctorId: z.uuid().optional(),
    status: z.enum(LAB_REQUEST_STATUSES).optional(),
});
