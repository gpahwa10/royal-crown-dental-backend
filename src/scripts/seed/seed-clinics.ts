import { readFileSync } from "fs";
import { join } from "path";
import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { clinics } from "../../db/schema/clinic";

export type SeedClinic = {
    id: number;
    name: string;
    address: string;
    phone: string;
};

const parseAddressMeta = (address: string) => {
    const pincodeMatch = address.match(/\b(\d{6})\b/);
    const pincode = pincodeMatch?.[1] ?? null;
    const state = address.includes("Maharashtra") ? "Maharashtra" : null;

    let city: string | null = null;
    if (address.includes("Mumbai")) {
        city = "Mumbai";
    } else if (address.includes("Thane")) {
        city = "Thane";
    } else if (address.includes("Vasai")) {
        city = "Vasai";
    } else if (address.includes("Virar")) {
        city = "Virar";
    }

    return {
        pincode,
        state,
        city,
        country: "India" as const,
    };
};

const buildClinicCode = (legacyId: number, name: string) => {
    const slug = name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return `CLINIC-${String(legacyId).padStart(3, "0")}-${slug}`;
};

export const loadClinicsFromJson = (): SeedClinic[] => {
    const filePath = join(process.cwd(), "drizzle/seed/clinics.json");
    const { clinics: records } = JSON.parse(readFileSync(filePath, "utf-8")) as {
        clinics: SeedClinic[];
    };
    return records;
};

export const seedClinics = async (records: SeedClinic[] = loadClinicsFromJson()) => {
    const clinicMap = new Map<number, string>();

    for (const record of records) {
        const addressMeta = parseAddressMeta(record.address);
        const values = {
            legacyClinicId: record.id,
            clinicName: record.name,
            clinicCode: buildClinicCode(record.id, record.name),
            phone: record.phone,
            address: record.address,
            city: addressMeta.city,
            state: addressMeta.state,
            country: addressMeta.country,
            pincode: addressMeta.pincode,
        };

        const [existing] = await db
            .select()
            .from(clinics)
            .where(eq(clinics.legacyClinicId, record.id));

        if (existing) {
            await db
                .update(clinics)
                .set({ ...values, updatedAt: new Date() })
                .where(eq(clinics.id, existing.id));

            clinicMap.set(record.id, existing.id);
            console.log(`Updated clinic #${record.id}: ${record.name}`);
            continue;
        }

        const [clinic] = await db.insert(clinics).values(values).returning();
        clinicMap.set(record.id, clinic.id);
        console.log(`Created clinic #${record.id}: ${record.name}`);
    }

    return clinicMap;
};
