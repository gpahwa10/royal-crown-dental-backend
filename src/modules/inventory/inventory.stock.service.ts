import {
    and,
    count,
    desc,
    eq,
    ilike,
    isNull,
    or,
    sql,
} from "drizzle-orm";
import { db } from "../../db/client";
import { inventoryCategory } from "../../db/schema/inventoryCategories";
import { inventoryItem } from "../../db/schema/inventoryItems";
import { inventoryStock } from "../../db/schema/inventoryStocks";
import { inventoryVariant } from "../../db/schema/inventoryVariants";
import {
    countActiveInventoryItems,
} from "./inventory.service";
import { buildPaginationMeta, getPagination } from "./inventory.utils";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface ListStockOptions {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    clinicId?: string;
    lowStock?: boolean;
}

export interface StockTargetInput {
    variantId?: string;
    itemId?: string;
}

export interface PurchaseInput extends StockTargetInput {
    clinicId: string;
    quantity: number;
    referenceNumber?: string;
    notes?: string;
}

export interface ConsumeInput extends StockTargetInput {
    clinicId: string;
    quantity: number;
    notes?: string;
}

export interface AdjustInput extends StockTargetInput {
    clinicId: string;
    adjustment: number;
    reason: string;
}

const lowStockCondition = sql`${inventoryStock.inStock} < COALESCE(NULLIF(${inventoryStock.requiredStock}, 0), ${inventoryItem.minimumStockLevel})`;

const resolveVariantId = async (
    input: StockTargetInput,
    tx: DbTransaction
) => {
    if (input.variantId) {
        return input.variantId;
    }

    if (!input.itemId) {
        throw new Error("variantId or itemId is required");
    }

    const variants = await tx
        .select({ id: inventoryVariant.id })
        .from(inventoryVariant)
        .where(
            and(
                eq(inventoryVariant.inventoryItemId, input.itemId),
                eq(inventoryVariant.isActive, true)
            )
        );

    if (variants.length === 0) {
        throw new Error("No variant found for this inventory item");
    }

    if (variants.length > 1) {
        throw new Error(
            "Item has multiple variants; provide variantId instead of itemId"
        );
    }

    return variants[0].id;
};

const getVariantWithItem = async (variantId: string, tx: DbTransaction) => {
    const [row] = await tx
        .select({
            variant: inventoryVariant,
            item: inventoryItem,
        })
        .from(inventoryVariant)
        .innerJoin(
            inventoryItem,
            eq(inventoryVariant.inventoryItemId, inventoryItem.id)
        )
        .where(
            and(
                eq(inventoryVariant.id, variantId),
                eq(inventoryVariant.isActive, true),
                eq(inventoryItem.isActive, true)
            )
        );

    if (!row) {
        throw new Error("Inventory variant not found");
    }

    return row;
};

const getOrCreateStock = async (
    variantId: string,
    clinicId: string,
    requiredStock: number,
    tx: DbTransaction
) => {
    const [existing] = await tx
        .select()
        .from(inventoryStock)
        .where(
            and(
                eq(inventoryStock.variantId, variantId),
                eq(inventoryStock.clinicId, clinicId)
            )
        );

    if (existing) {
        return existing;
    }

    const [created] = await tx
        .insert(inventoryStock)
        .values({
            variantId,
            clinicId,
            inStock: 0,
            reservedStock: 0,
            requiredStock,
        })
        .returning();

    return created;
};

const buildStockQuery = (options: ListStockOptions) => {
    const filters = [
        eq(inventoryVariant.isActive, true),
        eq(inventoryItem.isActive, true),
    ];

    if (options.categoryId) {
        filters.push(eq(inventoryItem.categoryId, options.categoryId));
    }
    if (options.clinicId) {
        filters.push(eq(inventoryStock.clinicId, options.clinicId));
        filters.push(
            or(
                eq(inventoryItem.clinicId, options.clinicId),
                isNull(inventoryItem.clinicId)
            )!
        );
    }
    if (options.search) {
        filters.push(
            or(
                ilike(inventoryItem.name, `%${options.search}%`),
                ilike(inventoryVariant.name, `%${options.search}%`)
            )!
        );
    }
    if (options.lowStock) {
        filters.push(lowStockCondition);
    }

    return filters;
};

export const listStock = async (options: ListStockOptions = {}) => {
    const { page, limit, offset } = getPagination(options.page, options.limit);
    const filters = buildStockQuery(options);
    const whereClause = and(...filters);

    const [countResult] = await db
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
        .where(whereClause);

    const total = Number(countResult.value);

    const items = await db
        .select({
            stock: inventoryStock,
            variant: inventoryVariant,
            item: inventoryItem,
            category: inventoryCategory,
        })
        .from(inventoryStock)
        .innerJoin(
            inventoryVariant,
            eq(inventoryStock.variantId, inventoryVariant.id)
        )
        .innerJoin(
            inventoryItem,
            eq(inventoryVariant.inventoryItemId, inventoryItem.id)
        )
        .innerJoin(
            inventoryCategory,
            eq(inventoryItem.categoryId, inventoryCategory.id)
        )
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(inventoryStock.updatedAt));

    return {
        items,
        pagination: buildPaginationMeta(page, limit, total),
    };
};

export const getClinicStock = async (
    clinicId: string,
    options: ListStockOptions = {}
) => listStock({ ...options, clinicId });

export const getLowStockItems = async (options: ListStockOptions = {}) =>
    listStock({ ...options, lowStock: true });

export const getOutOfStockItems = async (options: ListStockOptions = {}) => {
    const { page, limit, offset } = getPagination(options.page, options.limit);
    const filters = [
        ...buildStockQuery(options),
        eq(inventoryStock.inStock, 0),
    ];
    const whereClause = and(...filters);

    const [countResult] = await db
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
        .where(whereClause);

    const total = Number(countResult.value);

    const items = await db
        .select({
            stock: inventoryStock,
            variant: inventoryVariant,
            item: inventoryItem,
            category: inventoryCategory,
        })
        .from(inventoryStock)
        .innerJoin(
            inventoryVariant,
            eq(inventoryStock.variantId, inventoryVariant.id)
        )
        .innerJoin(
            inventoryItem,
            eq(inventoryVariant.inventoryItemId, inventoryItem.id)
        )
        .innerJoin(
            inventoryCategory,
            eq(inventoryItem.categoryId, inventoryCategory.id)
        )
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(inventoryStock.updatedAt));

    return {
        items,
        pagination: buildPaginationMeta(page, limit, total),
    };
};

export const getStockSummary = async (clinicId?: string) => {
    const clinicFilter = clinicId
        ? eq(inventoryStock.clinicId, clinicId)
        : undefined;

    const [totalItems, lowStock, outOfStock] = await Promise.all([
        db
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
                    clinicFilter
                )
            ),
        db
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
                    lowStockCondition,
                    clinicFilter
                )
            ),
        db
            .select({ value: count() })
            .from(inventoryStock)
            .innerJoin(
                inventoryVariant,
                eq(inventoryStock.variantId, inventoryVariant.id)
            )
            .where(
                and(
                    eq(inventoryVariant.isActive, true),
                    eq(inventoryStock.inStock, 0),
                    clinicFilter
                )
            ),
    ]);

    return {
        totalStockRecords: Number(totalItems[0].value),
        lowStockItems: Number(lowStock[0].value),
        outOfStockItems: Number(outOfStock[0].value),
    };
};

export const purchaseInventory = async (input: PurchaseInput) => {
    return db.transaction(async (tx) => {
        const variantId = await resolveVariantId(input, tx);
        const { item } = await getVariantWithItem(variantId, tx);
        const stock = await getOrCreateStock(
            variantId,
            input.clinicId,
            item.minimumStockLevel,
            tx
        );

        const [updated] = await tx
            .update(inventoryStock)
            .set({
                inStock: stock.inStock + input.quantity,
                updatedAt: new Date(),
            })
            .where(eq(inventoryStock.id, stock.id))
            .returning();

        return updated;
    });
};

export const consumeInventory = async (input: ConsumeInput) => {
    return db.transaction(async (tx) => {
        const variantId = await resolveVariantId(input, tx);
        await getVariantWithItem(variantId, tx);

        const [stock] = await tx
            .select()
            .from(inventoryStock)
            .where(
                and(
                    eq(inventoryStock.variantId, variantId),
                    eq(inventoryStock.clinicId, input.clinicId)
                )
            );

        if (!stock) {
            throw new Error("Stock record not found");
        }

        if (stock.inStock < input.quantity) {
            throw new Error("Insufficient stock");
        }

        const [updated] = await tx
            .update(inventoryStock)
            .set({
                inStock: stock.inStock - input.quantity,
                updatedAt: new Date(),
            })
            .where(eq(inventoryStock.id, stock.id))
            .returning();

        return updated;
    });
};

export const adjustInventory = async (input: AdjustInput) => {
    return db.transaction(async (tx) => {
        const variantId = await resolveVariantId(input, tx);
        const { item } = await getVariantWithItem(variantId, tx);
        const stock = await getOrCreateStock(
            variantId,
            input.clinicId,
            item.minimumStockLevel,
            tx
        );

        const next = stock.inStock + input.adjustment;
        if (next < 0) {
            throw new Error("Insufficient stock");
        }

        const [updated] = await tx
            .update(inventoryStock)
            .set({
                inStock: next,
                updatedAt: new Date(),
            })
            .where(eq(inventoryStock.id, stock.id))
            .returning();

        return updated;
    });
};

export const getInventoryDashboard = async (clinicId?: string) => {
    const [totalInventoryItems, summary] = await Promise.all([
        countActiveInventoryItems(),
        getStockSummary(clinicId),
    ]);

    return {
        totalInventoryItems,
        ...summary,
        clinicId: clinicId ?? null,
    };
};

export const getClinicInventoryDashboard = async (clinicId: string) =>
    getInventoryDashboard(clinicId);
