import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../../db/client";
import { clinics } from "../../db/schema/clinic";
import { inventoryCategory } from "../../db/schema/inventoryCategories";
import { createInventoryItem } from "./inventory.service";
import { eq } from "drizzle-orm";

describe("createInventoryItem", () => {
    let clinicId: string;
    let categoryId: string;

    beforeAll(async () => {
        const unique = Date.now().toString();

        const [clinic] = await db
            .insert(clinics)
            .values({
                clinicName: `Inventory Test Clinic ${unique}`,
                clinicCode: `INVTEST${unique}`,
                isActive: true,
            })
            .returning();
        clinicId = clinic.id;

        const [category] = await db
            .insert(inventoryCategory)
            .values({
                name: `Inventory Test Category ${unique}`,
            })
            .returning();
        categoryId = category.id;
    });

    afterAll(async () => {
        await db
            .delete(inventoryCategory)
            .where(eq(inventoryCategory.id, categoryId));
        await db.delete(clinics).where(eq(clinics.id, clinicId));
    });

    it("rejects a duplicate sku in the same clinic", async () => {
        await createInventoryItem({
            clinicId,
            categoryId,
            name: "Composite Filling",
            sku: "ITEM-001",
            unit: "unit",
            minimumStockLevel: 1,
        });

        await expect(
            createInventoryItem({
                clinicId,
                categoryId,
                name: "Root Canal File",
                sku: "ITEM-001",
                unit: "unit",
                minimumStockLevel: 1,
            })
        ).rejects.toThrow("An inventory item with this item ID already exists");
    });
});
