import { readFileSync } from "fs";
import { join } from "path";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { clinics } from "../../db/schema/clinic";
import { inventoryCategory } from "../../db/schema/inventoryCategories";
import { inventoryItem } from "../../db/schema/inventoryItems";
import { inventoryStock } from "../../db/schema/inventoryStocks";
import { inventoryVariant } from "../../db/schema/inventoryVariants";

const DEFAULT_VARIANT_NAME = "Default";
const DEFAULT_UNIT = "pcs";
const EQUIPMENT_CATEGORY = "Equipment";

const CSV_PATH = join(
    process.cwd(),
    "docs/data-migration-templates/YourVCare Master Data - Inventory Items.csv"
);

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
    const parsed = JSON.parse(readFileSync(filePath, "utf-8")) as {
        inventory?: SeedInventoryCategory[];
        warehouse?: unknown;
    };
    return { inventory: parsed.inventory ?? [] };
};

const splitAcrossVariants = (total: number, count: number) => {
    const base = Math.floor(total / count);
    const remainder = total % count;
    return Array.from({ length: count }, (_, index) =>
        index === count - 1 ? base + remainder : base
    );
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
    clinicId: string,
    inStock: number,
    requiredStock: number
) => {
    await db
        .insert(inventoryStock)
        .values({
            variantId,
            clinicId,
            inStock,
            requiredStock,
            reservedStock: 0,
        })
        .onConflictDoUpdate({
            target: [inventoryStock.variantId, inventoryStock.clinicId],
            set: {
                inStock,
                requiredStock,
                updatedAt: new Date(),
            },
        });
};

const seedItemStockForClinics = async (
    item: SeedInventoryItem,
    variantRecords: { id: string }[],
    clinicIds: string[]
) => {
    const inStockSplit = splitAcrossVariants(item.in_stock, variantRecords.length);
    const requiredSplit = splitAcrossVariants(item.required, variantRecords.length);

    for (let index = 0; index < variantRecords.length; index += 1) {
        const variantId = variantRecords[index].id;
        const inStock = inStockSplit[index];
        const requiredStock = requiredSplit[index];

        for (const clinicId of clinicIds) {
            await upsertStock(variantId, clinicId, inStock, requiredStock);
        }
    }
};

export const getSeededCurrentStockSummary = async (clinicId?: string) => {
    const whereClause = clinicId
        ? eq(inventoryStock.clinicId, clinicId)
        : undefined;

    const [stock] = await db
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
        .where(whereClause);

    return {
        records: Number(stock.records),
        totalInStock: stock.totalInStock,
        totalRequired: stock.totalRequired,
    };
};

export const seedInventory = async (options?: { clinicId?: string }) => {
    const data = (() => {
        try {
            return loadInventoryFromCsv();
        } catch {
            return loadInventoryFromJson();
        }
    })();

    const clinicFilter = options?.clinicId ?? process.env.CLINIC_ID;
    const clinicRows = clinicFilter
        ? await db
              .select({ id: clinics.id, clinicName: clinics.clinicName })
              .from(clinics)
              .where(
                  and(eq(clinics.id, clinicFilter), eq(clinics.isActive, true))
              )
        : await db
              .select({ id: clinics.id, clinicName: clinics.clinicName })
              .from(clinics)
              .where(eq(clinics.isActive, true));

    if (clinicRows.length === 0) {
        throw new Error(
            "No active clinics found to seed inventory stock against"
        );
    }

    const clinicIds = clinicRows.map((clinic) => clinic.id);
    console.log(
        `Seeding clinic stock for: ${clinicRows.map((c) => c.clinicName).join(", ")}`
    );

    let categories = 0;
    let items = 0;
    let variants = 0;

    for (const group of data.inventory) {
        const category = await upsertCategory(group.category);
        categories += 1;

        for (const item of group.items) {
            const savedItem = await upsertGlobalItem(
                category.id,
                item,
                group.category
            );
            items += 1;

            const variantNames =
                item.variants.length > 0 ? item.variants : [DEFAULT_VARIANT_NAME];
            const variantRecords = [];

            for (const variantName of variantNames) {
                const variant = await upsertVariant(savedItem.id, variantName);
                variantRecords.push(variant);
                variants += 1;
            }

            await seedItemStockForClinics(item, variantRecords, clinicIds);
            console.log(
                `  ${savedItem.name} — ${variantRecords.length} variant(s) × ${clinicIds.length} clinic(s)`
            );
        }
    }

    const currentStock = await getSeededCurrentStockSummary(clinicFilter);

    return {
        categories,
        items,
        variants,
        stockRecords: currentStock.records,
        clinicCount: clinicIds.length,
        clinicIds,
        currentStock,
    };
};
