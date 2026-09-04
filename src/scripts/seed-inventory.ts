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
    console.log(
        `Stock totals:    ${result.currentStock.totalInStock} in stock / ${result.currentStock.totalRequired} required`
    );
    console.log(
        "\nNote: Stock is clinic-scoped (no warehouse / locations / transfers)."
    );
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
