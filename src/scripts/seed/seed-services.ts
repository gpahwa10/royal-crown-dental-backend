import { readFileSync } from "fs";
import { join } from "path";
import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { clinics } from "../../db/schema/clinic";
import { serviceCatalog } from "../../db/schema/serviceCatalog";
import { generateServiceCode } from "../../modules/service-catalog/serviceCatalog.utils";

const CSV_PATH = join(
    process.cwd(),
    "docs/data-migration-templates/YourVCare Master Data - SER.csv"
);

export type ServiceSeedRow = {
    serviceName: string;
    defaultPrice: number;
};

const normalizeNameKey = (name: string) =>
    name.trim().toLowerCase().replace(/\s+/g, " ");

const parsePrice = (raw: string): number | null => {
    const cleaned = raw.replace(/[^\d.]/g, "").trim();
    if (!cleaned) return null;
    const value = Number.parseInt(cleaned, 10);
    if (Number.isNaN(value) || value < 0) return null;
    return value;
};

/** Load unique services from SER.csv (first occurrence wins; duplicates skipped). */
export const loadServicesFromCsv = (
    filePath: string = CSV_PATH
): ServiceSeedRow[] => {
    const content = readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    const seen = new Set<string>();
    const rows: ServiceSeedRow[] = [];

    for (const line of lines) {
        if (!line.trim()) continue;

        const cols = line.split(",");
        const name = (cols[0] ?? "").trim();
        const priceRaw = (cols[1] ?? "").trim();

        if (!name || !priceRaw) continue;

        const headerKey = normalizeNameKey(name);
        if (
            headerKey === "treatment name" ||
            headerKey === "cost" ||
            headerKey === "treatment name cost"
        ) {
            continue;
        }

        const price = parsePrice(priceRaw);
        if (price === null) continue;

        const key = normalizeNameKey(name);
        if (seen.has(key)) {
            console.warn(`Skipping duplicate CSV row: "${name}"`);
            continue;
        }
        seen.add(key);

        rows.push({
            serviceName: name.trim(),
            defaultPrice: price,
        });
    }

    return rows;
};

export type SeedServicesResult = {
    clinicCount: number;
    csvServices: number;
    created: number;
    skippedExisting: number;
};

export const seedServices = async (
    filePath: string = CSV_PATH
): Promise<SeedServicesResult> => {
    const services = loadServicesFromCsv(filePath);

    const clinicRows = await db
        .select({ id: clinics.id, clinicName: clinics.clinicName })
        .from(clinics)
        .where(eq(clinics.isActive, true));

    if (clinicRows.length === 0) {
        throw new Error("No active clinics found. Run seed:clinics first.");
    }

    let created = 0;
    let skippedExisting = 0;
    const now = new Date();

    for (const clinic of clinicRows) {
        const existing = await db
            .select({
                serviceName: serviceCatalog.serviceName,
            })
            .from(serviceCatalog)
            .where(eq(serviceCatalog.clinicId, clinic.id));

        const existingKeys = new Set(
            existing.map((row) => normalizeNameKey(row.serviceName))
        );

        for (const service of services) {
            const key = normalizeNameKey(service.serviceName);
            if (existingKeys.has(key)) {
                skippedExisting += 1;
                continue;
            }

            const serviceCode = await generateServiceCode(clinic.id);

            await db.insert(serviceCatalog).values({
                serviceCode,
                serviceName: service.serviceName,
                isActive: true,
                clinicId: clinic.id,
                createdAt: now,
                updatedAt: now,
            });

            existingKeys.add(key);
            created += 1;
        }

        console.log(
            `Clinic "${clinic.clinicName}": seeded services (running total created: ${created})`
        );
    }

    return {
        clinicCount: clinicRows.length,
        csvServices: services.length,
        created,
        skippedExisting,
    };
};
