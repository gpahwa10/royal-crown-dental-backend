import { z } from "zod";

export const serviceCatalogIdParamSchema = z.object({
    id: z.uuid(),
});

export const createServiceCatalogSchema = z.object({
    clinicId: z.uuid().optional(),
    serviceCode: z
        .string()
        .trim()
        .min(1)
        .max(50)
        .transform((value) => value.toUpperCase())
        .optional(),
    serviceName: z.string().trim().min(1),
    description: z.string().trim().optional(),
    category: z.string().trim().optional(),
    defaultPrice: z.coerce.number().int().min(0),
    taxPercentage: z.coerce.number().int().min(0).max(100).default(0),
    isTaxable: z.boolean().default(true),
});

export const updateServiceCatalogSchema = z
    .object({
        serviceCode: z
            .string()
            .trim()
            .min(1)
            .max(50)
            .transform((value) => value.toUpperCase())
            .optional(),
        serviceName: z.string().trim().min(1).optional(),
        description: z.string().trim().nullable().optional(),
        category: z.string().trim().nullable().optional(),
        defaultPrice: z.coerce.number().int().min(0).optional(),
        taxPercentage: z.coerce.number().int().min(0).max(100).optional(),
        isTaxable: z.boolean().optional(),
        isActive: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field is required",
    });

export const serviceCatalogListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    clinicId: z.uuid().optional(),
    search: z.string().trim().optional(),
    category: z.string().trim().optional(),
    isActive: z
        .enum(["true", "false"])
        .optional()
        .transform((value) =>
            value === undefined ? undefined : value === "true"
        ),
});
