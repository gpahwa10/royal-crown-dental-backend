import { z } from "zod";

export const patientIdParamSchema = z
    .object({
        patientId: z.uuid().optional(),
        id: z.uuid().optional(),
    })
    .refine((data) => Boolean(data.patientId || data.id), {
        message: "patientId is required",
    })
    .transform((data) => ({
        patientId: (data.patientId ?? data.id)!,
    }));

export const consultationIdParamSchema = z
    .object({
        consultationId: z.uuid().optional(),
        id: z.uuid().optional(),
    })
    .refine((data) => Boolean(data.consultationId || data.id), {
        message: "consultationId is required",
    })
    .transform((data) => ({
        consultationId: (data.consultationId ?? data.id)!,
    }));

export const updateConsultationOdontogramSchema = z.object({
    statusChart: z.record(z.string(), z.unknown()),
    planChart: z.record(z.string(), z.unknown()).nullable().optional(),
    version: z.number().int().positive(),
});

export const toothNumberParamSchema = z.object({
    toothNumber: z
        .string()
        .trim()
        .min(1)
        .max(10)
        .regex(/^[0-9A-Za-z]+$/, "toothNumber must be alphanumeric"),
});

export const updateToothNotesSchema = z.object({
    notes: z
        .string()
        .trim()
        .max(2000)
        .nullable()
        .transform((value) => (value === "" ? null : value)),
    version: z.number().int().positive(),
});
