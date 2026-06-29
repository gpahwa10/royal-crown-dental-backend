import { z } from "zod";

export const consultationIdParamSchema = z.object({
    id: z.uuid(),
});

export const patientIdParamSchema = z.object({
    patientId: z.uuid(),
});

export const createConsultationSchema = z.object({
    patientId: z.uuid(),
    doctorId: z.uuid(),
    clinicId: z.uuid().optional(),
    appointmentId: z.uuid().optional(),
    chiefComplaint: z.string().trim().min(1),
});

export const updateConsultationSchema = z
    .object({
        chiefComplaint: z.string().trim().min(1).optional(),
        diagnosis: z.string().trim().nullable().optional(),
        treatmentPlan: z.string().trim().nullable().optional(),
        clinicalNotes: z.string().trim().nullable().optional(),
        nextVisitDate: z.coerce.date().nullable().optional(),
        consentRequired: z.boolean().optional(),
        consentSigned: z.boolean().optional(),
        consentSignatureUrl: z.string().trim().nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field is required",
    });

export const startConsultationSchema = z.object({}).strict().optional().default({});

export const completeConsultationSchema = z.object({}).strict().optional().default({});
