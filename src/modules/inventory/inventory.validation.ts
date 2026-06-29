import { z } from "zod";
import { LOCATION_TYPES, TRANSACTION_TYPES } from "./inventory.constants";

const variantSchema = z.object({
    name: z.string().min(1),
    sku: z.string().min(1).optional(),
});

export const createInventoryItemSchema = z.object({
    categoryId: z.uuid(),
    clinicId: z.uuid().optional(),
    name: z.string().min(1),
    unit: z.string().min(1),
    sku: z.string().min(1).optional(),
    minimumStockLevel: z.number().int().min(0),
    description: z.string().optional(),
    variants: z.array(variantSchema).optional().default([]),
});

export const bulkCreateInventoryItemsSchema = z
    .array(createInventoryItemSchema)
    .min(1);

export const updateInventoryItemSchema = z
    .object({
        name: z.string().min(1).optional(),
        categoryId: z.uuid().optional(),
        clinicId: z.uuid().nullable().optional(),
        unit: z.string().min(1).optional(),
        sku: z.string().min(1).optional(),
        minimumStockLevel: z.number().int().min(0).optional(),
        description: z.string().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field is required",
    });

export const inventoryItemParamsSchema = z.object({
    id: z.uuid(),
});

export const getInventoryItemQuerySchema = z.object({
    clinicId: z.uuid().optional(),
});

export const itemHistoryQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const listInventoryItemsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().optional(),
    categoryId: z.uuid().optional(),
    clinicId: z.uuid().optional(),
    clinicOnly: z
        .enum(["true", "false"])
        .optional()
        .transform((value) => value === "true"),
    isActive: z
        .enum(["true", "false"])
        .optional()
        .transform((value) => (value === undefined ? undefined : value === "true")),
});

export const createVariantSchema = z.object({
    inventoryItemId: z.uuid(),
    name: z.string().min(1),
    sku: z.string().min(1).optional(),
});

export const updateVariantSchema = z
    .object({
        name: z.string().min(1).optional(),
        sku: z.string().min(1).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field is required",
    });

export const variantParamsSchema = z.object({
    id: z.uuid(),
});

export const createCategorySchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    parentCategoryId: z.uuid().optional(),
});

export const updateCategorySchema = z
    .object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        parentCategoryId: z.uuid().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field is required",
    });

export const categoryParamsSchema = z.object({
    id: z.uuid(),
});

export const createLocationSchema = z.object({
    name: z.string().min(1),
    type: z.enum([LOCATION_TYPES.CLINIC, LOCATION_TYPES.WAREHOUSE]),
    city: z.string().optional(),
    address: z.string().optional(),
    clinicId: z.uuid().optional(),
});

export const updateLocationSchema = z
    .object({
        name: z.string().min(1).optional(),
        type: z.enum([LOCATION_TYPES.CLINIC, LOCATION_TYPES.WAREHOUSE]).optional(),
        city: z.string().optional(),
        address: z.string().optional(),
        clinicId: z.uuid().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field is required",
    });

export const locationParamsSchema = z.object({
    id: z.uuid(),
});

export const clinicParamsSchema = z.object({
    clinicId: z.uuid(),
});

export const listStockQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
    categoryId: z.uuid().optional(),
    clinicId: z.uuid().optional(),
    locationId: z.uuid().optional(),
    lowStock: z
        .enum(["true", "false"])
        .optional()
        .transform((value) => value === "true"),
});

const stockTargetSchema = z
    .object({
        variantId: z.uuid().optional(),
        itemId: z.uuid().optional(),
    })
    .refine((data) => Boolean(data.variantId || data.itemId), {
        message: "variantId or itemId is required",
    });

export const purchaseInventorySchema = stockTargetSchema.and(
    z.object({
        locationId: z.uuid(),
        quantity: z.number().int().positive(),
        referenceNumber: z.string().optional(),
        notes: z.string().optional(),
    })
);

export const transferInventorySchema = stockTargetSchema.and(
    z.object({
        fromLocationId: z.uuid(),
        toLocationId: z.uuid(),
        quantity: z.number().int().positive(),
        notes: z.string().optional(),
    })
);

export const consumeInventorySchema = stockTargetSchema.and(
    z.object({
        locationId: z.uuid(),
        quantity: z.number().int().positive(),
        notes: z.string().optional(),
    })
);

export const adjustInventorySchema = stockTargetSchema.and(
    z.object({
        locationId: z.uuid(),
        adjustment: z.number().int().refine((value) => value !== 0, {
            message: "Adjustment cannot be zero",
        }),
        reason: z.string().min(1),
    })
);

export const listTransactionsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    type: z
        .enum([
            TRANSACTION_TYPES.PURCHASE,
            TRANSACTION_TYPES.TRANSFER,
            TRANSACTION_TYPES.USAGE,
            TRANSACTION_TYPES.ADJUSTMENT,
            TRANSACTION_TYPES.DAMAGED,
            TRANSACTION_TYPES.EXPIRED,
            TRANSACTION_TYPES.RETURN,
        ])
        .optional(),
    locationId: z.uuid().optional(),
    variantId: z.uuid().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
});

export const transactionParamsSchema = z.object({
    id: z.uuid(),
});
