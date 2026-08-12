import "dotenv/config";
import { seedInventory } from "./seed/seed-inventory";

const main = async () => {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is not set");
    }

    const result = await seedInventory();

    console.log("\n--- Inventory seed summary ---");
    console.log(`Categories:      ${result.categories}`);
    console.log(`Items:           ${result.items}`);
    console.log(`Variants:        ${result.variants}`);
    console.log(`Stock records:   ${result.stockRecords}`);
    console.log(`Clinics seeded:  ${result.clinicCount}`);
    console.log(`Warehouse ID:    ${result.warehouseId}`);

    console.log("\n--- Current stock sample data ---");
    console.log(
        `Warehouse:       ${result.currentStock.warehouse.totalInStock} in stock / ${result.currentStock.warehouse.totalRequired} required (${result.currentStock.warehouse.records} records)`
    );
    console.log(
        `All clinics:     ${result.currentStock.clinics.totalInStock} in stock / ${result.currentStock.clinics.totalRequired} required (${result.currentStock.clinics.records} records)`
    );
    console.log(
        `Seed transactions: ${result.currentStock.seedTransactions} (purchase + transfer)`
    );
    console.log(
        "\nNote: Loaded from docs/data-migration-templates/YourVCare Master Data - Inventory Items.csv. Warehouse holds full quantities; each clinic holds ~30%."
    );
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
