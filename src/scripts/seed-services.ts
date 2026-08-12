import "dotenv/config";
import { seedServices } from "./seed/seed-services";

const main = async () => {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is not set");
    }

    const result = await seedServices();

    console.log("\n--- Service catalog seed summary ---");
    console.log(`Active clinics:        ${result.clinicCount}`);
    console.log(`Unique CSV services:   ${result.csvServices}`);
    console.log(`Rows created:          ${result.created}`);
    console.log(`Skipped (exists):      ${result.skippedExisting}`);
    console.log(`All services:          non-taxable, active`);
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
