import { readFileSync } from "fs";
import { join } from "path";
import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { clinics } from "../../db/schema/clinic";

export type SeedClinicRecord = {
    legacyClinicId: number;
    clinicName: string;
    clinicCode: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    pincode: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    isActive: boolean;
};

const CSV_PATH = join(
    process.cwd(),
    "src/scripts/new-data/YourVCare Master Data - Clinics.csv"
);

/** Minimal RFC4180 CSV parser that supports quoted multiline fields. */
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
        // Skip completely empty rows
        if (row.some((value) => value.trim() !== "")) {
            rows.push(row);
        }
        row = [];
    };

    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        const next = content[i + 1];

        if (inQuotes) {
            if (char === '"' && next === '"') {
                field += '"';
                i += 1;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                field += char;
            }
            continue;
        }

        if (char === '"') {
            inQuotes = true;
            continue;
        }

        if (char === ",") {
            pushField();
            continue;
        }

        if (char === "\n") {
            pushField();
            pushRow();
            continue;
        }

        if (char === "\r") {
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

const normalizeHeader = (header: string) =>
    header.trim().toLowerCase().replace(/\s+/g, "_");

const cleanText = (value?: string | null) => {
    if (value === undefined || value === null) {
        return null;
    }

    const trimmed = value.replace(/\s+/g, " ").trim();
    return trimmed === "" ? null : trimmed;
};

const normalizePhone = (value?: string | null) => {
    const cleaned = cleanText(value);
    if (!cleaned) {
        return null;
    }

    // Prefer the first number when multiple are separated by / or ,
    const first = cleaned.split(/[/,|]/)[0]?.trim() ?? cleaned;
    return first.slice(0, 20);
};

const parseIsActive = (value?: string | null) => {
    const normalized = cleanText(value)?.toLowerCase();
    if (!normalized) {
        return true;
    }

    return !["inactive", "false", "0", "no"].includes(normalized);
};

const buildClinicCode = (legacyId: number, name: string) => {
    const slug = name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 32);

    return `CLINIC-${String(legacyId).padStart(3, "0")}-${slug}`;
};

/**
 * Keep legacy IDs aligned with previous drizzle/seed/clinics.json so
 * employee seed clinic_id references stay valid.
 */
const resolveLegacyClinicId = (clinicName: string, fallbackId: number) => {
    const normalized = clinicName.toLowerCase();

    if (normalized.includes("jogeshwari")) return 1;
    if (normalized.includes("kandiwali") || normalized.includes("kandivali"))
        return 2;
    if (normalized.includes("bhayender") || normalized.includes("bhayandar"))
        return 3;
    if (normalized.includes("vasai")) return 4;
    if (normalized.includes("thane")) return 5;
    if (normalized.includes("mira")) return 6;
    if (normalized.includes("nalasopara east") || normalized.includes("nallasopara east"))
        return 7;
    if (normalized.includes("nalasopara west") || normalized.includes("nallasopara west"))
        return 8;
    if (normalized.includes("virar west")) return 9;
    if (normalized.includes("virar east")) return 10;

    return fallbackId;
};

export const loadClinicsFromCsv = (
    filePath: string = CSV_PATH
): SeedClinicRecord[] => {
    const content = readFileSync(filePath, "utf-8");
    const rows = parseCsv(content);

    if (rows.length < 2) {
        throw new Error(`No clinic rows found in ${filePath}`);
    }

    const headers = rows[0].map(normalizeHeader);
    const headerIndex = (name: string) => headers.indexOf(name);

    const clinicNameIdx = headerIndex("clinic_name");
    const isActiveIdx = headerIndex("is_active");
    const emailIdx = headerIndex("email");
    const phoneIdx = headerIndex("phone");
    const addressIdx = headerIndex("address");
    const pincodeIdx = headerIndex("pincode");
    const cityIdx = headerIndex("city");
    const stateIdx = headerIndex("state");
    const countryIdx = headerIndex("country");

    if (clinicNameIdx < 0) {
        throw new Error("CSV is missing required column: clinic_name");
    }

    const records: SeedClinicRecord[] = [];
    let fallbackId = 100;

    for (const row of rows.slice(1)) {
        const clinicName = cleanText(row[clinicNameIdx]);
        if (!clinicName) {
            continue;
        }

        const legacyClinicId = resolveLegacyClinicId(clinicName, fallbackId);
        if (legacyClinicId === fallbackId) {
            fallbackId += 1;
        }

        records.push({
            legacyClinicId,
            clinicName,
            clinicCode: buildClinicCode(legacyClinicId, clinicName),
            email: cleanText(row[emailIdx]),
            phone: normalizePhone(row[phoneIdx]),
            address: cleanText(row[addressIdx]),
            pincode: cleanText(row[pincodeIdx]),
            city: cleanText(row[cityIdx]),
            state: cleanText(row[stateIdx]),
            country: cleanText(row[countryIdx]) ?? "India",
            isActive: parseIsActive(row[isActiveIdx]),
        });
    }

    return records;
};

export const seedClinics = async (
    records: SeedClinicRecord[] = loadClinicsFromCsv()
) => {
    const clinicMap = new Map<number, string>();

    for (const record of records) {
        const values = {
            legacyClinicId: record.legacyClinicId,
            clinicName: record.clinicName,
            clinicCode: record.clinicCode,
            email: record.email,
            phone: record.phone,
            address: record.address,
            city: record.city,
            state: record.state,
            country: record.country,
            pincode: record.pincode,
            isActive: record.isActive,
        };

        const [existingByLegacy] = await db
            .select()
            .from(clinics)
            .where(eq(clinics.legacyClinicId, record.legacyClinicId));

        const [existingByCode] = existingByLegacy
            ? [null]
            : await db
                  .select()
                  .from(clinics)
                  .where(eq(clinics.clinicCode, record.clinicCode));

        const existing = existingByLegacy ?? existingByCode;

        if (existing) {
            await db
                .update(clinics)
                .set({ ...values, updatedAt: new Date() })
                .where(eq(clinics.id, existing.id));

            clinicMap.set(record.legacyClinicId, existing.id);
            console.log(
                `Updated clinic #${record.legacyClinicId}: ${record.clinicName}`
            );
            continue;
        }

        const [clinic] = await db.insert(clinics).values(values).returning();
        clinicMap.set(record.legacyClinicId, clinic.id);
        console.log(
            `Created clinic #${record.legacyClinicId}: ${record.clinicName}`
        );
    }

    return clinicMap;
};
