import { z } from "zod";

export const uploadPrescriptionFieldsSchema = z.object({
    clinicId: z.string().uuid().optional(),
    patientId: z.string().uuid(),
    prescriptionId: z.string().uuid(),
});

export const prescriptionIdParamSchema = z.object({
    id: z.string().uuid(),
});

export const shareTokenParamSchema = z.object({
    token: z.string().min(16).max(128),
});
