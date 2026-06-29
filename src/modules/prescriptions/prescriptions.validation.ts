import { z } from "zod";

const prescriptionItemSchema = z.object({
    medicineName: z.string().trim().min(1),
    dosage: z.string().trim().optional(),
    frequency: z.string().trim().optional(),
    duration: z.string().trim().optional(),
    instructions: z.string().trim().optional(),
});

export const prescriptionIdParamSchema = z.object({
    id: z.uuid(),
});

export const consultationIdParamSchema = z.object({
    id: z.uuid(),
});

export const patientIdParamSchema = z.object({
    patientId: z.uuid(),
});

export const createPrescriptionSchema = z.object({
    notes: z.string().trim().optional(),
    items: z.array(prescriptionItemSchema).min(1),
});

export const updatePrescriptionSchema = z
    .object({
        notes: z.string().trim().nullable().optional(),
        items: z.array(prescriptionItemSchema).min(1).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field is required",
    });
