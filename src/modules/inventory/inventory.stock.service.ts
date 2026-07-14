import {
    and,
    count,
    desc,
    eq,
    gte,
    ilike,
    inArray,
    isNull,
    lte,
    or,
    sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../db/client";
import { inventoryCategory } from "../../db/schema/inventoryCategories";
import { inventoryItem } from "../../db/schema/inventoryItems";
import { inventoryLocation } from "../../db/schema/inventoryLocations";
import { inventoryStock } from "../../db/schema/inventoryStocks";
import { inventoryTransaction } from "../../db/schema/inventoryTransactions";
import { inventoryVariant } from "../../db/schema/inventoryVariants";
import { LOCATION_TYPES, TRANSACTION_TYPES } from "./inventory.constants";
import {
    countActiveClinicLocations,
    countActiveInventoryItems,
    countLowStockItems,
    countOutOfStockItems,
} from "./inventory.service";
import { buildPaginationMeta, getPagination } from "./inventory.utils";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface ListStockOptions {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    clinicId?: string;
    locationId?: string;
    lowStock?: boolean;
}

export interface StockTargetInput {
    variantId?: string;
    itemId?: string;
}

export interface PurchaseInput extends StockTargetInput {
    locationId: string;
    quantity: number;
    referenceNumber?: string;
    notes?: string;
}

export interface TransferInput extends StockTargetInput {
    fromLocationId: string;
    toLocationId: string;
    quantity: number;
    notes?: string;
}

export interface ConsumeInput extends StockTargetInput {
    locationId: string;
    quantity: number;
    notes?: string;
}

export interface AdjustInput extends StockTargetInput {
    locationId: string;
    adjustment: number;
    reason: string;
}

export interface ListTransactionsOptions {
    page?: number;
    limit?: number;
    type?: string;
    locationId?: string;
    variantId?: string;
    startDate?: Date;
    endDate?: Date;
}

const lowStockCondition = sql`${inventoryStock.inStock} < COALESCE(NULLIF(${inventoryStock.requiredStock}, 0), ${inventoryItem.minimumStockLevel})`;

const fromInventoryLocation = alias(inventoryLocation, "from_inventory_location");
const toInventoryLocation = alias(inventoryLocation, "to_inventory_location");

const toTransactionWithLocationNames = (row: {
    transaction: typeof inventoryTransaction.$inferSelect;
    itemName: string;
    fromLocationName: string | null;
    toLocationName: string | null;
}) => {
    const {
        variantId: _variantId,
        fromLocationId: _fromLocationId,
        toLocationId: _toLocationId,
        ...rest
    } = row.transaction;

    return {
        ...rest,
        itemName: row.itemName,
        fromLocationName: row.fromLocationName,
        toLocationName: row.toLocationName,
    };
};

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

const getActiveLocation = async (locationId: string, tx: DbTransaction) => {
    const [location] = await tx
        .select()
        .from(inventoryLocation)
        .where(
            and(
                eq(inventoryLocation.id, locationId),
                eq(inventoryLocation.isActive, true)
            )
        );

    if (!location) {
        throw new Error("Inventory location not found");
    }

    return location;
};

const getOrCreateStock = async (
    variantId: string,
    locationId: string,
    requiredStock: number,
    tx: DbTransaction
) => {
    const [existing] = await tx
        .select()
        .from(inventoryStock)
        .where(
            and(
                eq(inventoryStock.variantId, variantId),
                eq(inventoryStock.locationId, locationId)
            )
        );

    if (existing) {
        return existing;
    }

    const [created] = await tx
        .insert(inventoryStock)
        .values({
            variantId,
            locationId,
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
        filters.push(
            or(
                eq(inventoryItem.clinicId, options.clinicId),
                isNull(inventoryItem.clinicId)
            )!
        );
    }
    if (options.locationId) {
        filters.push(eq(inventoryStock.locationId, options.locationId));
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
        .innerJoin(
            inventoryLocation,
            eq(inventoryStock.locationId, inventoryLocation.id)
        )
        .where(whereClause);

    const total = Number(countResult.value);

    const items = await db
        .select({
            stock: inventoryStock,
            variant: inventoryVariant,
            item: inventoryItem,
            location: inventoryLocation,
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
            inventoryLocation,
            eq(inventoryStock.locationId, inventoryLocation.id)
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

export const getWarehouseStock = async (options: ListStockOptions = {}) => {
    const warehouseLocations = await db
        .select({ id: inventoryLocation.id })
        .from(inventoryLocation)
        .where(
            and(
                eq(inventoryLocation.type, LOCATION_TYPES.WAREHOUSE),
                eq(inventoryLocation.isActive, true)
            )
        );

    if (warehouseLocations.length === 0) {
        return {
            items: [],
            pagination: buildPaginationMeta(1, options.limit ?? 20, 0),
        };
    }

    const locationIds = warehouseLocations.map((location) => location.id);
    const { page, limit, offset } = getPagination(options.page, options.limit);

    const filters = [
        eq(inventoryVariant.isActive, true),
        eq(inventoryItem.isActive, true),
        inArray(inventoryStock.locationId, locationIds),
    ];

    if (options.locationId && locationIds.includes(options.locationId)) {
        filters.push(eq(inventoryStock.locationId, options.locationId));
    }
    if (options.search) {
        filters.push(
            or(
                ilike(inventoryItem.name, `%${options.search}%`),
                ilike(inventoryVariant.name, `%${options.search}%`)
            )!
        );
    }
    if (options.categoryId) {
        filters.push(eq(inventoryItem.categoryId, options.categoryId));
    }
    if (options.lowStock) {
        filters.push(lowStockCondition);
    }

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
            location: inventoryLocation,
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
            inventoryLocation,
            eq(inventoryStock.locationId, inventoryLocation.id)
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
) => {
    const clinicLocations = await db
        .select({ id: inventoryLocation.id })
        .from(inventoryLocation)
        .where(
            and(
                eq(inventoryLocation.clinicId, clinicId),
                eq(inventoryLocation.type, LOCATION_TYPES.CLINIC),
                eq(inventoryLocation.isActive, true)
            )
        );

    if (clinicLocations.length === 0) {
        return {
            items: [],
            pagination: buildPaginationMeta(1, options.limit ?? 20, 0),
        };
    }

    const locationIds = clinicLocations.map((location) => location.id);
    const { page, limit, offset } = getPagination(options.page, options.limit);

    const filters = [
        eq(inventoryVariant.isActive, true),
        eq(inventoryItem.isActive, true),
        inArray(inventoryStock.locationId, locationIds),
        or(
            eq(inventoryItem.clinicId, clinicId),
            isNull(inventoryItem.clinicId)
        )!,
    ];

    if (options.search) {
        filters.push(
            or(
                ilike(inventoryItem.name, `%${options.search}%`),
                ilike(inventoryVariant.name, `%${options.search}%`)
            )!
        );
    }
    if (options.categoryId) {
        filters.push(eq(inventoryItem.categoryId, options.categoryId));
    }
    if (options.lowStock) {
        filters.push(lowStockCondition);
    }

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
            location: inventoryLocation,
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
            inventoryLocation,
            eq(inventoryStock.locationId, inventoryLocation.id)
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

export const getLowStockItems = async (options: ListStockOptions = {}) =>
    listStock({ ...options, lowStock: true });

export const getOutOfStockItems = async (options: ListStockOptions = {}) => {
    const { page, limit, offset } = getPagination(options.page, options.limit);

    const filters = [
        eq(inventoryVariant.isActive, true),
        eq(inventoryItem.isActive, true),
        eq(inventoryStock.inStock, 0),
    ];

    if (options.categoryId) {
        filters.push(eq(inventoryItem.categoryId, options.categoryId));
    }
    if (options.locationId) {
        filters.push(eq(inventoryStock.locationId, options.locationId));
    }

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
            location: inventoryLocation,
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
            inventoryLocation,
            eq(inventoryStock.locationId, inventoryLocation.id)
        )
        .where(whereClause)
        .limit(limit)
        .offset(offset);

    return {
        items,
        pagination: buildPaginationMeta(page, limit, total),
    };
};

export const getStockSummary = async () => {
    const [totalItems, lowStockItems, outOfStockItems] = await Promise.all([
        countActiveInventoryItems(),
        countLowStockItems(),
        countOutOfStockItems(),
    ]);

    return {
        totalItems,
        lowStockItems,
        outOfStockItems,
    };
};

export const purchaseInventory = async (input: PurchaseInput) => {
    return db.transaction(async (tx) => {
        const variantId = await resolveVariantId(input, tx);
        const { item } = await getVariantWithItem(variantId, tx);
        await getActiveLocation(input.locationId, tx);

        const stock = await getOrCreateStock(
            variantId,
            input.locationId,
            item.minimumStockLevel,
            tx
        );

        const [updatedStock] = await tx
            .update(inventoryStock)
            .set({
                inStock: stock.inStock + input.quantity,
                updatedAt: new Date(),
            })
            .where(eq(inventoryStock.id, stock.id))
            .returning();

        const [transaction] = await tx
            .insert(inventoryTransaction)
            .values({
                variantId,
                toLocationId: input.locationId,
                quantity: input.quantity,
                transactionType: TRANSACTION_TYPES.PURCHASE,
                referenceNumber: input.referenceNumber,
                notes: input.notes,
            })
            .returning();

        return { stock: updatedStock, transaction };
    });
};

export const transferInventory = async (input: TransferInput) => {
    if (input.fromLocationId === input.toLocationId) {
        throw new Error("Source and destination locations must be different");
    }

    return db.transaction(async (tx) => {
        const variantId = await resolveVariantId(input, tx);
        const { item } = await getVariantWithItem(variantId, tx);
        await getActiveLocation(input.fromLocationId, tx);
        await getActiveLocation(input.toLocationId, tx);

        const fromStock = await getOrCreateStock(
            variantId,
            input.fromLocationId,
            item.minimumStockLevel,
            tx
        );

        if (fromStock.inStock < input.quantity) {
            throw new Error("Insufficient stock at source location");
        }

        const toStock = await getOrCreateStock(
            variantId,
            input.toLocationId,
            item.minimumStockLevel,
            tx
        );

        const [updatedFromStock] = await tx
            .update(inventoryStock)
            .set({
                inStock: fromStock.inStock - input.quantity,
                updatedAt: new Date(),
            })
            .where(eq(inventoryStock.id, fromStock.id))
            .returning();

        const [updatedToStock] = await tx
            .update(inventoryStock)
            .set({
                inStock: toStock.inStock + input.quantity,
                updatedAt: new Date(),
            })
            .where(eq(inventoryStock.id, toStock.id))
            .returning();

        const [transaction] = await tx
            .insert(inventoryTransaction)
            .values({
                variantId,
                fromLocationId: input.fromLocationId,
                toLocationId: input.toLocationId,
                quantity: input.quantity,
                transactionType: TRANSACTION_TYPES.TRANSFER,
                notes: input.notes,
            })
            .returning();

        return {
            fromStock: updatedFromStock,
            toStock: updatedToStock,
            transaction,
        };
    });
};

export const consumeInventory = async (input: ConsumeInput) => {
    return db.transaction(async (tx) => {
        const variantId = await resolveVariantId(input, tx);
        const { item } = await getVariantWithItem(variantId, tx);
        await getActiveLocation(input.locationId, tx);

        const stock = await getOrCreateStock(
            variantId,
            input.locationId,
            item.minimumStockLevel,
            tx
        );

        if (stock.inStock < input.quantity) {
            throw new Error("Insufficient stock");
        }

        const [updatedStock] = await tx
            .update(inventoryStock)
            .set({
                inStock: stock.inStock - input.quantity,
                updatedAt: new Date(),
            })
            .where(eq(inventoryStock.id, stock.id))
            .returning();

        const [transaction] = await tx
            .insert(inventoryTransaction)
            .values({
                variantId,
                fromLocationId: input.locationId,
                quantity: input.quantity,
                transactionType: TRANSACTION_TYPES.USAGE,
                notes: input.notes,
            })
            .returning();

        return { stock: updatedStock, transaction };
    });
};

export const adjustInventory = async (input: AdjustInput) => {
    return db.transaction(async (tx) => {
        const variantId = await resolveVariantId(input, tx);
        const { item } = await getVariantWithItem(variantId, tx);
        await getActiveLocation(input.locationId, tx);

        const stock = await getOrCreateStock(
            variantId,
            input.locationId,
            item.minimumStockLevel,
            tx
        );

        const nextStock = stock.inStock + input.adjustment;
        if (nextStock < 0) {
            throw new Error("Insufficient stock");
        }

        const [updatedStock] = await tx
            .update(inventoryStock)
            .set({
                inStock: nextStock,
                updatedAt: new Date(),
            })
            .where(eq(inventoryStock.id, stock.id))
            .returning();

        const [transaction] = await tx
            .insert(inventoryTransaction)
            .values({
                variantId,
                fromLocationId: input.adjustment < 0 ? input.locationId : null,
                toLocationId: input.adjustment > 0 ? input.locationId : null,
                quantity: Math.abs(input.adjustment),
                transactionType: TRANSACTION_TYPES.ADJUSTMENT,
                notes: input.reason,
            })
            .returning();

        return { stock: updatedStock, transaction };
    });
};

export const listTransactions = async (
    options: ListTransactionsOptions = {}
) => {
    const { page, limit, offset } = getPagination(options.page, options.limit);
    const filters = [];

    if (options.type) {
        filters.push(eq(inventoryTransaction.transactionType, options.type));
    }
    if (options.variantId) {
        filters.push(eq(inventoryTransaction.variantId, options.variantId));
    }
    if (options.locationId) {
        filters.push(
            or(
                eq(inventoryTransaction.fromLocationId, options.locationId),
                eq(inventoryTransaction.toLocationId, options.locationId)
            )!
        );
    }
    if (options.startDate) {
        filters.push(gte(inventoryTransaction.createdAt, options.startDate));
    }
    if (options.endDate) {
        filters.push(lte(inventoryTransaction.createdAt, options.endDate));
    }

    const whereClause = filters.length ? and(...filters) : undefined;

    const [countResult] = whereClause
        ? await db
              .select({ value: count() })
              .from(inventoryTransaction)
              .where(whereClause)
        : await db.select({ value: count() }).from(inventoryTransaction);

    const total = Number(countResult.value);

    const transactionQuery = db
        .select({
            transaction: inventoryTransaction,
            itemName: inventoryItem.name,
            fromLocationName: fromInventoryLocation.name,
            toLocationName: toInventoryLocation.name,
        })
        .from(inventoryTransaction)
        .innerJoin(
            inventoryVariant,
            eq(inventoryTransaction.variantId, inventoryVariant.id)
        )
        .innerJoin(
            inventoryItem,
            eq(inventoryVariant.inventoryItemId, inventoryItem.id)
        )
        .leftJoin(
            fromInventoryLocation,
            eq(inventoryTransaction.fromLocationId, fromInventoryLocation.id)
        )
        .leftJoin(
            toInventoryLocation,
            eq(inventoryTransaction.toLocationId, toInventoryLocation.id)
        )
        .orderBy(desc(inventoryTransaction.createdAt))
        .limit(limit)
        .offset(offset);

    const rows = whereClause
        ? await transactionQuery.where(whereClause)
        : await transactionQuery;

    const items = rows.map(toTransactionWithLocationNames);

    return {
        items,
        pagination: buildPaginationMeta(page, limit, total),
    };
};

export const getTransactionById = async (id: string) => {
    const [row] = await db
        .select({
            transaction: inventoryTransaction,
            itemName: inventoryItem.name,
            fromLocationName: fromInventoryLocation.name,
            toLocationName: toInventoryLocation.name,
        })
        .from(inventoryTransaction)
        .innerJoin(
            inventoryVariant,
            eq(inventoryTransaction.variantId, inventoryVariant.id)
        )
        .innerJoin(
            inventoryItem,
            eq(inventoryVariant.inventoryItemId, inventoryItem.id)
        )
        .leftJoin(
            fromInventoryLocation,
            eq(inventoryTransaction.fromLocationId, fromInventoryLocation.id)
        )
        .leftJoin(
            toInventoryLocation,
            eq(inventoryTransaction.toLocationId, toInventoryLocation.id)
        )
        .where(eq(inventoryTransaction.id, id));

    if (!row) {
        throw new Error("Inventory transaction not found");
    }

    return toTransactionWithLocationNames(row);
};

export const getInventoryDashboard = async () => {
    const [
        totalInventoryItems,
        totalClinics,
        lowStockItems,
        recentTransfers,
        recentPurchases,
    ] = await Promise.all([
        countActiveInventoryItems(),
        countActiveClinicLocations(),
        countLowStockItems(),
        db
            .select()
            .from(inventoryTransaction)
            .where(
                eq(inventoryTransaction.transactionType, TRANSACTION_TYPES.TRANSFER)
            )
            .orderBy(desc(inventoryTransaction.createdAt))
            .limit(5),
        db
            .select()
            .from(inventoryTransaction)
            .where(
                eq(
                    inventoryTransaction.transactionType,
                    TRANSACTION_TYPES.PURCHASE
                )
            )
            .orderBy(desc(inventoryTransaction.createdAt))
            .limit(5),
    ]);

    return {
        totalInventoryItems,
        totalClinics,
        lowStockItems,
        recentTransfers,
        recentPurchases,
    };
};

export const getClinicInventoryDashboard = async (clinicId: string) => {
    const clinicLocations = await db
        .select({ id: inventoryLocation.id })
        .from(inventoryLocation)
        .where(
            and(
                eq(inventoryLocation.clinicId, clinicId),
                eq(inventoryLocation.type, LOCATION_TYPES.CLINIC),
                eq(inventoryLocation.isActive, true)
            )
        );

    if (clinicLocations.length === 0) {
        return {
            clinicId,
            totalStockRecords: 0,
            lowStockItems: 0,
            outOfStockItems: 0,
            recentUsage: [],
        };
    }

    const locationIds = clinicLocations.map((location) => location.id);

    const [stockCount, lowStock, outOfStock, recentUsage] = await Promise.all([
        db
            .select({ value: count() })
            .from(inventoryStock)
            .where(inArray(inventoryStock.locationId, locationIds)),
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
                    inArray(inventoryStock.locationId, locationIds),
                    lowStockCondition
                )
            ),
        db
            .select({ value: count() })
            .from(inventoryStock)
            .where(
                and(
                    inArray(inventoryStock.locationId, locationIds),
                    eq(inventoryStock.inStock, 0)
                )
            ),
        db
            .select()
            .from(inventoryTransaction)
            .where(
                and(
                    eq(inventoryTransaction.transactionType, TRANSACTION_TYPES.USAGE),
                    inArray(inventoryTransaction.fromLocationId, locationIds)
                )
            )
            .orderBy(desc(inventoryTransaction.createdAt))
            .limit(5),
    ]);

    return {
        clinicId,
        totalStockRecords: Number(stockCount[0].value),
        lowStockItems: Number(lowStock[0].value),
        outOfStockItems: Number(outOfStock[0].value),
        recentUsage,
    };
};

export const getWarehouseDashboard = async () => {
    const warehouseLocations = await db
        .select({ id: inventoryLocation.id })
        .from(inventoryLocation)
        .where(
            and(
                eq(inventoryLocation.type, LOCATION_TYPES.WAREHOUSE),
                eq(inventoryLocation.isActive, true)
            )
        );

    if (warehouseLocations.length === 0) {
        return {
            totalStockRecords: 0,
            lowStockItems: 0,
            outOfStockItems: 0,
            recentPurchases: [],
            recentTransfers: [],
        };
    }

    const locationIds = warehouseLocations.map((location) => location.id);

    const [stockCount, lowStock, outOfStock, recentPurchases, recentTransfers] =
        await Promise.all([
            db
                .select({ value: count() })
                .from(inventoryStock)
                .where(inArray(inventoryStock.locationId, locationIds)),
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
                        inArray(inventoryStock.locationId, locationIds),
                        lowStockCondition
                    )
                ),
            db
                .select({ value: count() })
                .from(inventoryStock)
                .where(
                    and(
                        inArray(inventoryStock.locationId, locationIds),
                        eq(inventoryStock.inStock, 0)
                    )
                ),
            db
                .select()
                .from(inventoryTransaction)
                .where(
                    and(
                        eq(
                            inventoryTransaction.transactionType,
                            TRANSACTION_TYPES.PURCHASE
                        ),
                        inArray(inventoryTransaction.toLocationId, locationIds)
                    )
                )
                .orderBy(desc(inventoryTransaction.createdAt))
                .limit(5),
            db
                .select()
                .from(inventoryTransaction)
                .where(
                    and(
                        eq(
                            inventoryTransaction.transactionType,
                            TRANSACTION_TYPES.TRANSFER
                        ),
                        or(
                            inArray(
                                inventoryTransaction.fromLocationId,
                                locationIds
                            ),
                            inArray(
                                inventoryTransaction.toLocationId,
                                locationIds
                            )
                        )
                    )
                )
                .orderBy(desc(inventoryTransaction.createdAt))
                .limit(5),
        ]);

    return {
        totalStockRecords: Number(stockCount[0].value),
        lowStockItems: Number(lowStock[0].value),
        outOfStockItems: Number(outOfStock[0].value),
        recentPurchases,
        recentTransfers,
    };
};
