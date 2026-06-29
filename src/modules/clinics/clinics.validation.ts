import { z } from "zod";

export const clinicIdParamSchema = z.object({
    id: z.uuid(),
});

const optionalEmail = z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === "" ? undefined : value))
    .pipe(z.email().optional());

export const createClinicSchema = z.object({
    clinicName: z.string().trim().min(1).max(255),
    clinicCode: z
        .string()
        .trim()
        .min(1)
        .max(50)
        .transform((value) => value.toUpperCase())
        .optional(),
    email: optionalEmail,
    phone: z.string().trim().max(20).optional(),
    address: z.string().trim().optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    country: z.string().trim().max(100).optional(),
    pincode: z.string().trim().max(20).optional(),
    legacyClinicId: z.coerce.number().int().positive().optional(),
});

export const updateClinicSchema = z
    .object({
        clinicName: z.string().trim().min(1).max(255).optional(),
        clinicCode: z
            .string()
            .trim()
            .min(1)
            .max(50)
            .transform((value) => value.toUpperCase())
            .optional(),
        email: optionalEmail.nullable(),
        phone: z.string().trim().max(20).nullable().optional(),
        address: z.string().trim().nullable().optional(),
        city: z.string().trim().max(100).nullable().optional(),
        state: z.string().trim().max(100).nullable().optional(),
        country: z.string().trim().max(100).nullable().optional(),
        pincode: z.string().trim().max(20).nullable().optional(),
        isActive: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field is required",
    });

export const listClinicsQuerySchema = z.object({
    includeInactive: z
        .enum(["true", "false"])
        .optional()
        .transform((value) => value === "true"),
    search: z.string().trim().optional(),
});
