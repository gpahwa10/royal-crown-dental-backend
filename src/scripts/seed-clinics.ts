import "dotenv/config";
import { seedClinics } from "./seed/seed-clinics";

const main = async () => {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is not set");
    }

    const clinicMap = await seedClinics();
    console.log(`\nSeeded ${clinicMap.size} clinics.`);
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
