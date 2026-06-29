import {
    and,
    count,
    desc,
    eq,
    ilike,
    inArray,
    isNull,
    or,
    sql,
} from "drizzle-orm";
import { db } from "../../db/client";
import { inventoryCategory } from "../../db/schema/inventoryCategories";
import { inventoryItem } from "../../db/schema/inventoryItems";
import { inventoryLocation } from "../../db/schema/inventoryLocations";
import { inventoryStock } from "../../db/schema/inventoryStocks";
import { inventoryTransaction } from "../../db/schema/inventoryTransactions";
import { inventoryVariant } from "../../db/schema/inventoryVariants";
import { buildPaginationMeta, getPagination } from "./inventory.utils";

export interface CreateInventoryVariantInput {
    name: string;
    sku?: string;
}

export interface CreateInventoryInput {
    categoryId: string;
    clinicId?: string;
    name: string;
    unit: string;
    sku?: string;
    minimumStockLevel: number;
    description?: string;
    variants?: CreateInventoryVariantInput[];
}

export interface UpdateInventoryInput {
    name?: string;
    categoryId?: string;
    clinicId?: string | null;
    unit?: string;
    sku?: string;
    minimumStockLevel?: number;
    description?: string;
}

export interface CreateVariantInput {
    inventoryItemId: string;
    name: string;
    sku?: string;
}

export interface UpdateVariantInput {
    name?: string;
    sku?: string;
}

export interface CreateCategoryInput {
    name: string;
    description?: string;
    parentCategoryId?: string;
}

export interface UpdateCategoryInput {
    name?: string;
    description?: string;
    parentCategoryId?: string;
}

export interface CreateLocationInput {
    name: string;
    type: string;
    city?: string;
    address?: string;
    clinicId?: string;
}

export interface UpdateLocationInput {
    name?: string;
    type?: string;
    city?: string;
    address?: string;
    clinicId?: string;
}

export interface ListItemsOptions {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    clinicId?: string;
    clinicOnly?: boolean;
    isActive?: boolean;
}

const DEFAULT_VARIANT_NAME = "Default";

const fetchCurrentStockByItemIds = async (
    itemIds: string[],
    clinicId?: string
) => {
    const stockMap = new Map<
        string,
        { currentStock: number; reservedStock: number }
    >();

    if (itemIds.length === 0) {
        return stockMap;
    }

    for (const itemId of itemIds) {
        stockMap.set(itemId, { currentStock: 0, reservedStock: 0 });
    }

    const stockSum = clinicId
        ? sql<number>`coalesce(sum(case when ${inventoryLocation.clinicId} = ${clinicId} and ${inventoryLocation.isActive} = true then ${inventoryStock.inStock} else 0 end), 0)`
        : sql<number>`coalesce(sum(${inventoryStock.inStock}), 0)`;

    const reservedSum = clinicId
        ? sql<number>`coalesce(sum(case when ${inventoryLocation.clinicId} = ${clinicId} and ${inventoryLocation.isActive} = true then ${inventoryStock.reservedStock} else 0 end), 0)`
        : sql<number>`coalesce(sum(${inventoryStock.reservedStock}), 0)`;

    const rows = await db
        .select({
            itemId: inventoryItem.id,
            currentStock: stockSum.mapWith(Number),
            reservedStock: reservedSum.mapWith(Number),
        })
        .from(inventoryItem)
        .innerJoin(
            inventoryVariant,
            eq(inventoryVariant.inventoryItemId, inventoryItem.id)
        )
        .leftJoin(
            inventoryStock,
            eq(inventoryStock.variantId, inventoryVariant.id)
        )
        .leftJoin(
            inventoryLocation,
            eq(inventoryStock.locationId, inventoryLocation.id)
        )
        .where(
            and(
                inArray(inventoryItem.id, itemIds),
                eq(inventoryVariant.isActive, true)
            )
        )
        .groupBy(inventoryItem.id);

    for (const row of rows) {
        stockMap.set(row.itemId, {
            currentStock: row.currentStock,
            reservedStock: row.reservedStock,
        });
    }

    return stockMap;
};

const enrichItemWithStock = <
    T extends { id: string; minimumStockLevel: number },
>(
    item: T,
    stockMap: Map<string, { currentStock: number; reservedStock: number }>
) => {
    const stock = stockMap.get(item.id) ?? {
        currentStock: 0,
        reservedStock: 0,
    };

    return {
        ...item,
        currentStock: stock.currentStock,
        reservedStock: stock.reservedStock,
        isLowStock: stock.currentStock < item.minimumStockLevel,
    };
};

const buildClinicItemFilter = (clinicId: string, clinicOnly?: boolean) =>
    clinicOnly
        ? eq(inventoryItem.clinicId, clinicId)
        : or(
              eq(inventoryItem.clinicId, clinicId),
              isNull(inventoryItem.clinicId)
          );

const createItemWithVariants = async (
    input: CreateInventoryInput,
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0]
) => {
    const { variants = [], sku, ...itemData } = input;

    const duplicateFilter = itemData.clinicId
        ? and(
              eq(inventoryItem.categoryId, itemData.categoryId),
              eq(inventoryItem.name, itemData.name),
              eq(inventoryItem.clinicId, itemData.clinicId),
              eq(inventoryItem.isActive, true)
          )
        : and(
              eq(inventoryItem.categoryId, itemData.categoryId),
              eq(inventoryItem.name, itemData.name),
              isNull(inventoryItem.clinicId),
              eq(inventoryItem.isActive, true)
          );

    const [duplicate] = await tx
        .select({ id: inventoryItem.id })
        .from(inventoryItem)
        .where(duplicateFilter);

    if (duplicate) {
        throw new Error("An inventory item with this name already exists");
    }

    const normalizedVariants =
        variants.length > 0
            ? variants
            : [{ name: DEFAULT_VARIANT_NAME, sku }];

    const [item] = await tx
        .insert(inventoryItem)
        .values({ ...itemData, sku })
        .returning();

    const createdVariants = await tx
        .insert(inventoryVariant)
        .values(
            normalizedVariants.map((variant) => ({
                ...variant,
                inventoryItemId: item.id,
            }))
        )
        .returning();

    return { ...item, variants: createdVariants };
};

export const createInventoryItem = async (input: CreateInventoryInput) => {
    return db.transaction(async (tx) => createItemWithVariants(input, tx));
};

export const bulkCreateInventoryItems = async (
    inputs: CreateInventoryInput[]
) => {
    return db.transaction(async (tx) => {
        const results = [];
        for (const input of inputs) {
            results.push(await createItemWithVariants(input, tx));
        }
        return results;
    });
};

export const updateInventoryItem = async (
    id: string,
    input: UpdateInventoryInput
) => {
    const [existing] = await db
        .select({ id: inventoryItem.id })
        .from(inventoryItem)
        .where(and(eq(inventoryItem.id, id), eq(inventoryItem.isActive, true)));

    if (!existing) {
        throw new Error("Inventory item not found");
    }

    const [item] = await db
        .update(inventoryItem)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(inventoryItem.id, id))
        .returning();

    if (input.minimumStockLevel !== undefined) {
        const variants = await db
            .select({ id: inventoryVariant.id })
            .from(inventoryVariant)
            .where(eq(inventoryVariant.inventoryItemId, id));

        if (variants.length > 0) {
            await db
                .update(inventoryStock)
                .set({
                    requiredStock: input.minimumStockLevel,
                    updatedAt: new Date(),
                })
                .where(
                    inArray(
                        inventoryStock.variantId,
                        variants.map((variant) => variant.id)
                    )
                );
        }
    }

    return item;
};

export const deleteInventoryItem = async (id: string) => {
    const [existing] = await db
        .select({ id: inventoryItem.id })
        .from(inventoryItem)
        .where(and(eq(inventoryItem.id, id), eq(inventoryItem.isActive, true)));

    if (!existing) {
        throw new Error("Inventory item not found");
    }

    await db
        .update(inventoryVariant)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(inventoryVariant.inventoryItemId, id));

    const [item] = await db
        .update(inventoryItem)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(inventoryItem.id, id))
        .returning();

    return item;
};

export const listInventoryItems = async (options: ListItemsOptions = {}) => {
    const { page, limit, offset } = getPagination(options.page, options.limit);

    const filters = [];
    if (options.categoryId) {
        filters.push(eq(inventoryItem.categoryId, options.categoryId));
    }
    if (options.isActive !== undefined) {
        filters.push(eq(inventoryItem.isActive, options.isActive));
    } else {
        filters.push(eq(inventoryItem.isActive, true));
    }
    if (options.search) {
        filters.push(ilike(inventoryItem.name, `%${options.search}%`));
    }
    if (options.clinicId) {
        const clinicFilter = buildClinicItemFilter(
            options.clinicId,
            options.clinicOnly
        );
        if (clinicFilter) {
            filters.push(clinicFilter);
        }
    }

    const whereClause = filters.length ? and(...filters) : undefined;

    const [countResult] = whereClause
        ? await db
              .select({ value: count() })
              .from(inventoryItem)
              .where(whereClause)
        : await db.select({ value: count() }).from(inventoryItem);

    const total = Number(countResult.value);

    const items = whereClause
        ? await db
              .select()
              .from(inventoryItem)
              .where(whereClause)
              .limit(limit)
              .offset(offset)
              .orderBy(desc(inventoryItem.createdAt))
        : await db
              .select()
              .from(inventoryItem)
              .limit(limit)
              .offset(offset)
              .orderBy(desc(inventoryItem.createdAt));

    const stockMap = await fetchCurrentStockByItemIds(
        items.map((item) => item.id),
        options.clinicId
    );

    return {
        items: items.map((item) => enrichItemWithStock(item, stockMap)),
        pagination: buildPaginationMeta(page, limit, total),
    };
};

export const listInventoryItemsByClinic = async (
    clinicId: string,
    options: Omit<ListItemsOptions, "clinicId"> = {}
) => listInventoryItems({ ...options, clinicId });

export const getInventoryItemById = async (
    id: string,
    options?: { clinicId?: string }
) => {
    const [item] = await db
        .select()
        .from(inventoryItem)
        .where(and(eq(inventoryItem.id, id), eq(inventoryItem.isActive, true)));

    if (!item) {
        throw new Error("Inventory item not found");
    }

    const variants = await db
        .select()
        .from(inventoryVariant)
        .where(
            and(
                eq(inventoryVariant.inventoryItemId, id),
                eq(inventoryVariant.isActive, true)
            )
        );

    const variantIds = variants.map((variant) => variant.id);
    const stockRows =
        variantIds.length > 0
            ? await db
                  .select({
                      stock: inventoryStock,
                      location: inventoryLocation,
                  })
                  .from(inventoryStock)
                  .innerJoin(
                      inventoryLocation,
                      eq(inventoryStock.locationId, inventoryLocation.id)
                  )
                  .where(
                      options?.clinicId
                          ? and(
                                inArray(inventoryStock.variantId, variantIds),
                                eq(inventoryLocation.clinicId, options.clinicId),
                                eq(inventoryLocation.isActive, true)
                            )
                          : inArray(inventoryStock.variantId, variantIds)
                  )
            : [];

    const variantsWithStock = variants.map((variant) => {
        const variantStock = stockRows
            .filter((row) => row.stock.variantId === variant.id)
            .map((row) => ({
                ...row.stock,
                location: row.location,
            }));
        const totalInStock = variantStock.reduce(
            (sum, stock) => sum + stock.inStock,
            0
        );
        const totalReserved = variantStock.reduce(
            (sum, stock) => sum + stock.reservedStock,
            0
        );

        return {
            ...variant,
            stock: variantStock,
            currentStock: totalInStock,
            reservedStock: totalReserved,
            totalInStock,
            totalReserved,
        };
    });

    const totalInStock = variantsWithStock.reduce(
        (sum, variant) => sum + variant.totalInStock,
        0
    );
    const totalReserved = variantsWithStock.reduce(
        (sum, variant) => sum + variant.totalReserved,
        0
    );
    const lowStockVariants = variantsWithStock.filter(
        (variant) => variant.totalInStock < item.minimumStockLevel
    ).length;

    return {
        ...item,
        currentStock: totalInStock,
        reservedStock: totalReserved,
        isLowStock: totalInStock < item.minimumStockLevel,
        variants: variantsWithStock,
        stockSummary: {
            totalInStock,
            totalReserved,
            lowStockVariants,
        },
    };
};

export const getItemHistory = async (
    id: string,
    options: { page?: number; limit?: number } = {}
) => {
    const { page, limit, offset } = getPagination(options.page, options.limit);

    const [item] = await db
        .select({ id: inventoryItem.id })
        .from(inventoryItem)
        .where(eq(inventoryItem.id, id));

    if (!item) {
        throw new Error("Inventory item not found");
    }

    const variants = await db
        .select({ id: inventoryVariant.id })
        .from(inventoryVariant)
        .where(eq(inventoryVariant.inventoryItemId, id));

    if (variants.length === 0) {
        return {
            items: [],
            pagination: buildPaginationMeta(page, limit, 0),
        };
    }

    const variantFilter = inArray(
        inventoryTransaction.variantId,
        variants.map((variant) => variant.id)
    );

    const [countResult] = await db
        .select({ value: count() })
        .from(inventoryTransaction)
        .where(variantFilter);

    const total = Number(countResult.value);

    const items = await db
        .select()
        .from(inventoryTransaction)
        .where(variantFilter)
        .orderBy(desc(inventoryTransaction.createdAt))
        .limit(limit)
        .offset(offset);

    return {
        items,
        pagination: buildPaginationMeta(page, limit, total),
    };
};

export const createVariant = async (input: CreateVariantInput) => {
    const [item] = await db
        .select({ id: inventoryItem.id })
        .from(inventoryItem)
        .where(
            and(
                eq(inventoryItem.id, input.inventoryItemId),
                eq(inventoryItem.isActive, true)
            )
        );

    if (!item) {
        throw new Error("Inventory item not found");
    }

    const [variant] = await db
        .insert(inventoryVariant)
        .values(input)
        .returning();

    return variant;
};

export const updateVariant = async (id: string, input: UpdateVariantInput) => {
    const [existing] = await db
        .select({ id: inventoryVariant.id })
        .from(inventoryVariant)
        .where(
            and(eq(inventoryVariant.id, id), eq(inventoryVariant.isActive, true))
        );

    if (!existing) {
        throw new Error("Inventory variant not found");
    }

    const [variant] = await db
        .update(inventoryVariant)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(inventoryVariant.id, id))
        .returning();

    return variant;
};

export const deleteVariant = async (id: string) => {
    const [existing] = await db
        .select({ id: inventoryVariant.id })
        .from(inventoryVariant)
        .where(
            and(eq(inventoryVariant.id, id), eq(inventoryVariant.isActive, true))
        );

    if (!existing) {
        throw new Error("Inventory variant not found");
    }

    const [variant] = await db
        .update(inventoryVariant)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(inventoryVariant.id, id))
        .returning();

    return variant;
};

export const createCategory = async (input: CreateCategoryInput) => {
    const [category] = await db
        .insert(inventoryCategory)
        .values(input)
        .returning();

    return category;
};

export const listCategories = async () => {
    return db
        .select()
        .from(inventoryCategory)
        .where(eq(inventoryCategory.isActive, true))
        .orderBy(inventoryCategory.name);
};

export const getCategoryById = async (id: string) => {
    const [category] = await db
        .select()
        .from(inventoryCategory)
        .where(
            and(
                eq(inventoryCategory.id, id),
                eq(inventoryCategory.isActive, true)
            )
        );

    if (!category) {
        throw new Error("Inventory category not found");
    }

    return category;
};

export const updateCategory = async (
    id: string,
    input: UpdateCategoryInput
) => {
    const [existing] = await db
        .select({ id: inventoryCategory.id })
        .from(inventoryCategory)
        .where(
            and(
                eq(inventoryCategory.id, id),
                eq(inventoryCategory.isActive, true)
            )
        );

    if (!existing) {
        throw new Error("Inventory category not found");
    }

    const [category] = await db
        .update(inventoryCategory)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(inventoryCategory.id, id))
        .returning();

    return category;
};

export const deleteCategory = async (id: string) => {
    const [existing] = await db
        .select({ id: inventoryCategory.id })
        .from(inventoryCategory)
        .where(
            and(
                eq(inventoryCategory.id, id),
                eq(inventoryCategory.isActive, true)
            )
        );

    if (!existing) {
        throw new Error("Inventory category not found");
    }

    const [category] = await db
        .update(inventoryCategory)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(inventoryCategory.id, id))
        .returning();

    return category;
};

export const createLocation = async (input: CreateLocationInput) => {
    const [location] = await db
        .insert(inventoryLocation)
        .values(input)
        .returning();

    return location;
};

export const listLocations = async () => {
    return db
        .select()
        .from(inventoryLocation)
        .where(eq(inventoryLocation.isActive, true))
        .orderBy(inventoryLocation.name);
};

export const getLocationById = async (id: string) => {
    const [location] = await db
        .select()
        .from(inventoryLocation)
        .where(
            and(
                eq(inventoryLocation.id, id),
                eq(inventoryLocation.isActive, true)
            )
        );

    if (!location) {
        throw new Error("Inventory location not found");
    }

    return location;
};

export const updateLocation = async (
    id: string,
    input: UpdateLocationInput
) => {
    const [existing] = await db
        .select({ id: inventoryLocation.id })
        .from(inventoryLocation)
        .where(
            and(
                eq(inventoryLocation.id, id),
                eq(inventoryLocation.isActive, true)
            )
        );

    if (!existing) {
        throw new Error("Inventory location not found");
    }

    const [location] = await db
        .update(inventoryLocation)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(inventoryLocation.id, id))
        .returning();

    return location;
};

export const deleteLocation = async (id: string) => {
    const [existing] = await db
        .select({ id: inventoryLocation.id })
        .from(inventoryLocation)
        .where(
            and(
                eq(inventoryLocation.id, id),
                eq(inventoryLocation.isActive, true)
            )
        );

    if (!existing) {
        throw new Error("Inventory location not found");
    }

    const [location] = await db
        .update(inventoryLocation)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(inventoryLocation.id, id))
        .returning();

    return location;
};

export const countActiveInventoryItems = async () => {
    const [result] = await db
        .select({ value: count() })
        .from(inventoryItem)
        .where(eq(inventoryItem.isActive, true));

    return Number(result.value);
};

export const countActiveClinicLocations = async () => {
    const [result] = await db
        .select({ value: count() })
        .from(inventoryLocation)
        .where(
            and(
                eq(inventoryLocation.isActive, true),
                eq(inventoryLocation.type, "clinic")
            )
        );

    return Number(result.value);
};

export const countLowStockItems = async () => {
    const [result] = await db
        .select({ value: count() })
        .from(inventoryStock)
        .innerJoin(
            inventoryVariant,
            eq(inventoryStock.variantId, inventoryVariant.id)
        )
        .innerJoin(
            inventoryItem,
            eq(inventoryVariant.inventoryItemId, inventoryItem.id)
        )
        .where(
            and(
                eq(inventoryVariant.isActive, true),
                eq(inventoryItem.isActive, true),
                sql`${inventoryStock.inStock} < COALESCE(NULLIF(${inventoryStock.requiredStock}, 0), ${inventoryItem.minimumStockLevel})`
            )
        );

    return Number(result.value);
};

export const countOutOfStockItems = async () => {
    const [result] = await db
        .select({ value: count() })
        .from(inventoryStock)
        .innerJoin(
            inventoryVariant,
            eq(inventoryStock.variantId, inventoryVariant.id)
        )
        .where(
            and(
                eq(inventoryVariant.isActive, true),
                eq(inventoryStock.inStock, 0)
            )
        );

    return Number(result.value);
};
