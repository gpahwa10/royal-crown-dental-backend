import "dotenv/config";
import { loadClinicsFromCsv, seedClinics } from "./seed/seed-clinics";

const main = async () => {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is not set");
    }

    const records = loadClinicsFromCsv();
    console.log(`Loaded ${records.length} clinics from CSV.`);

    const clinicMap = await seedClinics(records);
    console.log(`\nSeeded ${clinicMap.size} clinics.`);
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
