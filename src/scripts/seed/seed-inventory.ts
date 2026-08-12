import { readFileSync } from "fs";
import { join } from "path";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { clinics } from "../../db/schema/clinic";
import { inventoryCategory } from "../../db/schema/inventoryCategories";
import { inventoryItem } from "../../db/schema/inventoryItems";
import { inventoryLocation } from "../../db/schema/inventoryLocations";
import { inventoryStock } from "../../db/schema/inventoryStocks";
import { inventoryTransaction } from "../../db/schema/inventoryTransactions";
import { inventoryVariant } from "../../db/schema/inventoryVariants";
import {
    LOCATION_TYPES,
    TRANSACTION_TYPES,
} from "../../modules/inventory/inventory.constants";

const DEFAULT_VARIANT_NAME = "Default";
const DEFAULT_UNIT = "pcs";
const EQUIPMENT_CATEGORY = "Equipment";
const CLINIC_STOCK_RATIO = 0.3;
const SEED_TRANSACTION_NOTE = "seed-inventory csv data";

const CSV_PATH = join(
    process.cwd(),
    "docs/data-migration-templates/YourVCare Master Data - Inventory Items.csv"
);

const DEFAULT_WAREHOUSE = {
    name: "Central Warehouse",
    city: "Mumbai",
    address: "Central Distribution Hub, Mumbai, Maharashtra",
};

type SeedInventoryItem = {
    name: string;
    variants: string[];
    in_stock: number;
    required: number;
    sku?: string;
    unit?: string;
    description?: string;
    isActive?: boolean;
};

type SeedInventoryCategory = {
    category: string;
    items: SeedInventoryItem[];
};

type SeedInventoryFile = {
    warehouse: {
        name: string;
        city: string;
        address: string;
    };
    inventory: SeedInventoryCategory[];
};

/** Minimal RFC4180 CSV parser that supports quoted fields. */
const parseCsv = (content: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;

    const pushField = () => {
        row.push(field);
        field = "";
    };

    const pushRow = () => {
        if (row.some((value) => value.trim() !== "")) {
            rows.push(row);
        }
        row = [];
    };

    for (let i = 0; i < content.length; i += 1) {
        const char = content[i];
        const next = content[i + 1];

        if (char === '"') {
            if (inQuotes && next === '"') {
                field += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (!inQuotes && char === ",") {
            pushField();
            continue;
        }

        if (!inQuotes && (char === "\n" || char === "\r")) {
            if (char === "\r" && next === "\n") {
                i += 1;
            }
            pushField();
            pushRow();
            continue;
        }

        field += char;
    }

    if (field.length > 0 || row.length > 0) {
        pushField();
        pushRow();
    }

    return rows;
};

const parseNumber = (raw: string, fallback = 0) => {
    const value = Number.parseInt(raw.trim(), 10);
    return Number.isNaN(value) ? fallback : value;
};

export const loadInventoryFromCsv = (
    filePath: string = CSV_PATH
): SeedInventoryFile => {
    const content = readFileSync(filePath, "utf8");
    const rows = parseCsv(content);
    const [header, ...dataRows] = rows;

    if (!header?.[0]?.toLowerCase().includes("item_name")) {
        throw new Error(`Unexpected CSV header in ${filePath}`);
    }

    const categoryMap = new Map<string, SeedInventoryItem[]>();

    for (const cols of dataRows) {
        const name = (cols[0] ?? "").trim();
        const categoryName = (cols[1] ?? "").trim();
        if (!name || !categoryName) {
            continue;
        }

        const variantsRaw = (cols[6] ?? "").trim();
        const variants = variantsRaw
            ? variantsRaw.split("|").map((v) => v.trim()).filter(Boolean)
            : [];

        const item: SeedInventoryItem = {
            name,
            variants,
            in_stock: parseNumber(cols[8] ?? "0"),
            required: parseNumber(cols[5] ?? "0"),
            sku: (cols[3] ?? "").trim() || undefined,
            unit: (cols[4] ?? "").trim() || undefined,
            description: (cols[7] ?? "").trim() || undefined,
            isActive: (cols[9] ?? "true").trim().toLowerCase() !== "false",
        };

        const existing = categoryMap.get(categoryName) ?? [];
        existing.push(item);
        categoryMap.set(categoryName, existing);
    }

    return {
        warehouse: DEFAULT_WAREHOUSE,
        inventory: Array.from(categoryMap.entries()).map(
            ([category, items]) => ({
                category,
                items,
            })
        ),
    };
};

export const loadInventoryFromJson = (): SeedInventoryFile => {
    const filePath = join(process.cwd(), "drizzle/seed/inventory.json");
    return JSON.parse(readFileSync(filePath, "utf-8")) as SeedInventoryFile;
};

const splitAcrossVariants = (total: number, count: number) => {
    const base = Math.floor(total / count);
    const remainder = total % count;
    return Array.from({ length: count }, (_, index) =>
        index === count - 1 ? base + remainder : base
    );
};

const clinicStockFromWarehouse = (warehouseStock: number) => {
    if (warehouseStock <= 0) {
        return 0;
    }

    return Math.max(1, Math.floor(warehouseStock * CLINIC_STOCK_RATIO));
};

const resolveUnit = (categoryName: string) =>
    categoryName === EQUIPMENT_CATEGORY ? "unit" : DEFAULT_UNIT;

const upsertCategory = async (name: string) => {
    const [existing] = await db
        .select()
        .from(inventoryCategory)
        .where(
            and(
                eq(inventoryCategory.name, name),
                eq(inventoryCategory.isActive, true)
            )
        );

    if (existing) {
        return existing;
    }

    const [created] = await db
        .insert(inventoryCategory)
        .values({ name })
        .returning();

    return created;
};

const upsertGlobalItem = async (
    categoryId: string,
    item: SeedInventoryItem,
    categoryName: string
) => {
    const [existing] = await db
        .select()
        .from(inventoryItem)
        .where(
            and(
                eq(inventoryItem.categoryId, categoryId),
                eq(inventoryItem.name, item.name),
                isNull(inventoryItem.clinicId),
                eq(inventoryItem.isActive, true)
            )
        );

    const values = {
        categoryId,
        name: item.name,
        sku: item.sku,
        unit: item.unit ?? resolveUnit(categoryName),
        minimumStockLevel: item.required,
        description:
            item.description ?? `${item.name} — seeded inventory item`,
        isActive: item.isActive ?? true,
    };

    if (existing) {
        const [updated] = await db
            .update(inventoryItem)
            .set({ ...values, updatedAt: new Date() })
            .where(eq(inventoryItem.id, existing.id))
            .returning();
        return updated;
    }

    const [created] = await db.insert(inventoryItem).values(values).returning();
    return created;
};

const upsertVariant = async (inventoryItemId: string, name: string) => {
    const [existing] = await db
        .select()
        .from(inventoryVariant)
        .where(
            and(
                eq(inventoryVariant.inventoryItemId, inventoryItemId),
                eq(inventoryVariant.name, name),
                eq(inventoryVariant.isActive, true)
            )
        );

    if (existing) {
        return existing;
    }

    const [created] = await db
        .insert(inventoryVariant)
        .values({ inventoryItemId, name })
        .returning();

    return created;
};

const upsertStock = async (
    variantId: string,
    locationId: string,
    inStock: number,
    requiredStock: number
) => {
    await db
        .insert(inventoryStock)
        .values({
            variantId,
            locationId,
            inStock,
            requiredStock,
            reservedStock: 0,
        })
        .onConflictDoUpdate({
            target: [inventoryStock.variantId, inventoryStock.locationId],
            set: {
                inStock,
                requiredStock,
                updatedAt: new Date(),
            },
        });
};

const recordPurchaseTransaction = async (
    variantId: string,
    locationId: string,
    quantity: number,
    itemName: string
) => {
    if (quantity <= 0) {
        return;
    }

    await db.insert(inventoryTransaction).values({
        variantId,
        toLocationId: locationId,
        quantity,
        transactionType: TRANSACTION_TYPES.PURCHASE,
        referenceNumber: "SEED-PURCHASE",
        notes: `${SEED_TRANSACTION_NOTE} — initial purchase for ${itemName}`,
    });
};

const recordTransferTransaction = async (
    variantId: string,
    fromLocationId: string,
    toLocationId: string,
    quantity: number,
    itemName: string
) => {
    if (quantity <= 0) {
        return;
    }

    await db.insert(inventoryTransaction).values({
        variantId,
        fromLocationId,
        toLocationId,
        quantity,
        transactionType: TRANSACTION_TYPES.TRANSFER,
        notes: `${SEED_TRANSACTION_NOTE} — clinic refill for ${itemName}`,
    });
};

const upsertWarehouseLocation = async (warehouse: SeedInventoryFile["warehouse"]) => {
    const [existing] = await db
        .select()
        .from(inventoryLocation)
        .where(
            and(
                eq(inventoryLocation.name, warehouse.name),
                eq(inventoryLocation.type, LOCATION_TYPES.WAREHOUSE),
                eq(inventoryLocation.isActive, true)
            )
        );

    if (existing) {
        const [updated] = await db
            .update(inventoryLocation)
            .set({
                city: warehouse.city,
                address: warehouse.address,
                updatedAt: new Date(),
            })
            .where(eq(inventoryLocation.id, existing.id))
            .returning();
        return updated;
    }

    const [created] = await db
        .insert(inventoryLocation)
        .values({
            name: warehouse.name,
            type: LOCATION_TYPES.WAREHOUSE,
            city: warehouse.city,
            address: warehouse.address,
        })
        .returning();

    return created;
};

const upsertClinicLocation = async (clinic: {
    id: string;
    clinicName: string;
    city: string | null;
    address: string | null;
}) => {
    const locationName = `${clinic.clinicName} Clinic`;

    const [existing] = await db
        .select()
        .from(inventoryLocation)
        .where(
            and(
                eq(inventoryLocation.clinicId, clinic.id),
                eq(inventoryLocation.type, LOCATION_TYPES.CLINIC),
                eq(inventoryLocation.isActive, true)
            )
        );

    if (existing) {
        const [updated] = await db
            .update(inventoryLocation)
            .set({
                name: locationName,
                city: clinic.city,
                address: clinic.address,
                updatedAt: new Date(),
            })
            .where(eq(inventoryLocation.id, existing.id))
            .returning();
        return updated;
    }

    const [created] = await db
        .insert(inventoryLocation)
        .values({
            name: locationName,
            type: LOCATION_TYPES.CLINIC,
            clinicId: clinic.id,
            city: clinic.city,
            address: clinic.address,
        })
        .returning();

    return created;
};

const seedItemStockAtLocations = async (
    item: SeedInventoryItem,
    variantRecords: { id: string }[],
    warehouseId: string,
    clinicLocationIds: string[]
) => {
    const inStockSplit = splitAcrossVariants(item.in_stock, variantRecords.length);
    const requiredSplit = splitAcrossVariants(item.required, variantRecords.length);

    for (let index = 0; index < variantRecords.length; index += 1) {
        const variantId = variantRecords[index].id;
        const warehouseInStock = inStockSplit[index];
        const warehouseRequired = requiredSplit[index];
        const clinicInStock = clinicStockFromWarehouse(warehouseInStock);
        const clinicRequired = clinicStockFromWarehouse(warehouseRequired);

        await upsertStock(
            variantId,
            warehouseId,
            warehouseInStock,
            warehouseRequired
        );
        await recordPurchaseTransaction(
            variantId,
            warehouseId,
            warehouseInStock,
            item.name
        );

        for (const clinicLocationId of clinicLocationIds) {
            await upsertStock(
                variantId,
                clinicLocationId,
                clinicInStock,
                clinicRequired
            );
            await recordTransferTransaction(
                variantId,
                warehouseId,
                clinicLocationId,
                clinicInStock,
                item.name
            );
        }
    }
};

export const getSeededCurrentStockSummary = async (warehouseId: string) => {
    const [warehouseStock] = await db
        .select({
            records: count(),
            totalInStock: sql<number>`coalesce(sum(${inventoryStock.inStock}), 0)`.mapWith(
                Number
            ),
            totalRequired: sql<number>`coalesce(sum(${inventoryStock.requiredStock}), 0)`.mapWith(
                Number
            ),
        })
        .from(inventoryStock)
        .where(eq(inventoryStock.locationId, warehouseId));

    const [clinicStock] = await db
        .select({
            records: count(),
            totalInStock: sql<number>`coalesce(sum(${inventoryStock.inStock}), 0)`.mapWith(
                Number
            ),
            totalRequired: sql<number>`coalesce(sum(${inventoryStock.requiredStock}), 0)`.mapWith(
                Number
            ),
        })
        .from(inventoryStock)
        .innerJoin(
            inventoryLocation,
            eq(inventoryStock.locationId, inventoryLocation.id)
        )
        .where(eq(inventoryLocation.type, LOCATION_TYPES.CLINIC));

    const [transactionCount] = await db
        .select({ value: count() })
        .from(inventoryTransaction)
        .where(sql`${inventoryTransaction.notes} like ${`%${SEED_TRANSACTION_NOTE}%`}`);

    return {
        warehouse: {
            records: Number(warehouseStock.records),
            totalInStock: warehouseStock.totalInStock,
            totalRequired: warehouseStock.totalRequired,
        },
        clinics: {
            records: Number(clinicStock.records),
            totalInStock: clinicStock.totalInStock,
            totalRequired: clinicStock.totalRequired,
        },
        seedTransactions: Number(transactionCount.value),
    };
};

export const seedInventory = async (
    data: SeedInventoryFile = loadInventoryFromCsv()
) => {
    const activeClinics = await db
        .select()
        .from(clinics)
        .where(eq(clinics.isActive, true));

    if (activeClinics.length === 0) {
        throw new Error(
            "No active clinics found. Run npm run seed:clinics first."
        );
    }

    const warehouse = await upsertWarehouseLocation(data.warehouse);
    console.log(`Warehouse: ${warehouse.name}`);

    const clinicLocations = [];
    for (const clinic of activeClinics) {
        const location = await upsertClinicLocation(clinic);
        clinicLocations.push(location);
        console.log(`Clinic location: ${location.name}`);
    }

    const clinicLocationIds = clinicLocations.map((location) => location.id);

    let categoryCount = 0;
    let itemCount = 0;
    let variantCount = 0;
    let stockCount = 0;

    for (const categoryBlock of data.inventory) {
        const category = await upsertCategory(categoryBlock.category);
        categoryCount += 1;
        console.log(`\nCategory: ${category.name}`);

        for (const item of categoryBlock.items) {
            const savedItem = await upsertGlobalItem(
                category.id,
                item,
                categoryBlock.category
            );
            itemCount += 1;

            const variantNames =
                item.variants.length > 0
                    ? item.variants
                    : [DEFAULT_VARIANT_NAME];

            const variantRecords = [];
            for (const variantName of variantNames) {
                const variant = await upsertVariant(savedItem.id, variantName);
                variantRecords.push(variant);
                variantCount += 1;
            }

            await seedItemStockAtLocations(
                item,
                variantRecords,
                warehouse.id,
                clinicLocationIds
            );
            stockCount +=
                variantRecords.length * (1 + clinicLocationIds.length);

            console.log(
                `  ${savedItem.name} — ${variantRecords.length} variant(s), warehouse + ${clinicLocationIds.length} clinic stock`
            );
        }
    }

    const currentStock = await getSeededCurrentStockSummary(warehouse.id);

    return {
        categories: categoryCount,
        items: itemCount,
        variants: variantCount,
        stockRecords: stockCount,
        warehouseId: warehouse.id,
        clinicLocationIds,
        clinicCount: clinicLocations.length,
        currentStock,
    };
};
