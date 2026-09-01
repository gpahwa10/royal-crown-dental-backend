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
