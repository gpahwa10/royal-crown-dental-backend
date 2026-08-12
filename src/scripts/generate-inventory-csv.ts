/**
 * One-off generator: reads messy master CSV and writes a clean seed-ready CSV.
 * Run: npx ts-node-dev --transpile-only -r dotenv/config src/scripts/generate-inventory-csv.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const INPUT_PATH = join(
    process.cwd(),
    "docs/YourVCare Master Data - Inventory Items.csv"
);
const OUTPUT_PATH = join(
    process.cwd(),
    "docs/data-migration-templates/YourVCare Master Data - Inventory Items.csv"
);

const EQUIPMENT_NAMES = new Set(
    [
        "SEALING MACHINE",
        "UV CHAMBER",
        "AUTOCLAVE",
        "BOILER",
        "ALPINE STONE BUR",
        "SANDPAPER",
        "APEX LOCATOR",
        "CURING MACHINE",
        "SCALER",
        "ENDOMOTOR",
        "AIROTOR",
        "CONTRIANGLE",
        "STRAIGHT HANDPIECE",
        "ULTRASONIC ACTIVATOR",
        "INTRUMENT TRAY",
        "ENDOBOX",
        "BUR BOX",
    ].map((n) => n.toLowerCase())
);

const VARIANT_OVERRIDES: Record<string, string[]> = {
    gloves: ["Nitrile", "Latex"],
    "green cloth": ["Big", "Small"],
    gic: ["Luting", "Restorative"],
    composite: ["Flowable", "Restorative"],
    "applicator tip": ["Fine", "Regular"],
    protaper: ["21mm", "25mm", "Sx", "S1", "S2", "F1", "F2", "F3"],
    "k file": ["21mm", "25mm", "Assorted 31mm"],
    "h file": ["21mm 15-40", "21mm 45-80", "25mm 15-40", "25mm 45-80"],
    "rotary files": ["Coronal Flare 17-4%", "20-4%", "25-4%", "Glide Path File"],
    spreader: ["20", "25"],
    "gutta percha": ["20-2% F1", "25-2% F2", "20-4% F3", "25-4% F3"],
    "paper point": ["F1", "20-4% F2", "25-4% F3"],
    "peeso reamers": ["32mm 1", "32mm 2", "Assorted 1-6"],
    "sugical bur": ["Straight", "Round"],
    putty: ["Activator", "Accelerator"],
};

const NAME_OVERRIDES: Record<string, string> = {
    gic: "GIC",
    "rc help": "RC Help",
    "rc cal": "RC Cal",
    "rc pex (metapex)": "RC Pex (Metapex)",
    "edta liquid": "EDTA Liquid",
    "rc solve": "RC Solve",
    "mta putty": "MTA Putty",
    "dpi paste": "DPI Paste",
    "uv chamber": "UV Chamber",
    airotor: "Airotor",
    contriangle: "Contra Angle",
    pmt: "PMT",
    "gauze and guaze balls": "Gauze and Gauze Balls",
    "zinc oxide powder and eugnol liquid": "Zinc Oxide Powder and Eugenol Liquid",
};

const PPE_NAMES = new Set(["MASK", "HEADCAP"].map((n) => n.toLowerCase()));

const CATEGORY_MAP: Record<string, string> = {
    "sterilisation reel": "Sterilization & Consumables",
    "disinfectant liquid (glutapex)": "Sterilization & Consumables",
    gloves: "Sterilization & Consumables",
    "unolock syringe": "Sterilization & Consumables",
    "local anesthesia": "Sterilization & Consumables",
    "topical spray": "Sterilization & Consumables",
    "green cloth": "Cotton & Basic Materials",
    "cotton holder": "Cotton & Basic Materials",
    "cotton roll holder": "Cotton & Basic Materials",
    cotton: "Cotton & Basic Materials",
    "gauze and guaze balls": "Cotton & Basic Materials",
    "endoblock (scale)": "Dental Materials",
    "oil spray": "Dental Materials",
    "composite filling instrument": "Dental Materials",
    "agate spatula": "Dental Materials",
    "cement spatula": "Dental Materials",
    alginate: "Dental Materials",
    "modelling wax": "Dental Materials",
    "zinc oxide powder and eugnol liquid": "Dental Materials",
    biosealer: "Dental Materials",
    "bleaching kit": "Dental Materials",
    gic: "Filling Materials",
    composite: "Filling Materials",
    "dual cure resin": "Filling Materials",
    "bonding agent": "Filling Materials",
    etchant: "Filling Materials",
    "applicator tip": "Accessories",
    "articulating paper": "Accessories",
    "matrix band": "Accessories",
    "mylar strip": "Accessories",
    wedges: "Accessories",
    "teflon tape": "Accessories",
    protaper: "Endodontics",
    "k file": "Endodontics",
    "h file": "Endodontics",
    "retreatment files": "Endodontics",
    "rotary files": "Endodontics",
    spreader: "Endodontics",
    "gutta percha": "Endodontics",
    "paper point": "Endodontics",
    "rc help": "Chemicals",
    "rc cal": "Chemicals",
    "rc pex (metapex)": "Chemicals",
    "edta liquid": "Chemicals",
    formocresol: "Chemicals",
    "rc solve": "Chemicals",
    saline: "Chemicals",
    hypo: "Chemicals",
    chlorhex: "Chemicals",
    "hydrogen peroxide": "Chemicals",
    post: "Surgical",
    "peeso reamers": "Surgical",
    "mta putty": "Surgical",
    "bio dentin": "Surgical",
    "temporary filling material": "Surgical",
    "moons probe": "Surgical",
    "suture needle": "Surgical",
    "needle holder": "Surgical",
    "sugical bur": "Surgical",
    betadine: "Surgical",
    "haemostat liquid": "Surgical",
    abgel: "Surgical",
    "graft and membrane": "Surgical",
    "mouth wash": "Sterilization & Consumables",
    "suction tip": "Sterilization & Consumables",
    "wax knife, carver": "Dental Materials",
    "glass slab": "Dental Materials",
    "mixing pad": "Dental Materials",
    "blow torch and gas refill": "Dental Materials",
    "prophylaxis paste and brush": "Dental Materials",
    "dpi paste": "Dental Materials",
    "green stick": "Dental Materials",
    putty: "Dental Materials",
    "shade guide": "Dental Materials",
    "mouth prop": "Dental Materials",
    burs: "Endodontics",
    mask: "PPE",
    headcap: "PPE",
    pmt: "General",
};

/** Minimal RFC4180 CSV parser supporting quoted multiline fields. */
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

const normalizeKey = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, " ");

const titleCase = (value: string) =>
    value
        .trim()
        .split(/\s+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");

const parseMinStock = (raw: string, variantCount: number): number => {
    const cleaned = raw.trim();
    if (!cleaned) {
        return variantCount > 1 ? 10 : 5;
    }

    if (cleaned.toLowerCase().includes("each class")) {
        return 10;
    }

    const numbers = cleaned.match(/\d+/g)?.map(Number) ?? [];
    if (numbers.length === 0) {
        return 5;
    }

    const value =
        cleaned.includes("+") || cleaned.includes("-")
            ? Math.max(...numbers)
            : numbers[0];

    return value === 0 ? 5 : value;
};

const normalizeUnit = (raw: string, category: string): string => {
    const unit = raw.trim().toLowerCase();
    if (!unit) {
        return category === "Equipment" ? "unit" : "pcs";
    }

    const map: Record<string, string> = {
        reel: "reel",
        bottle: "bottle",
        box: "box",
        carton: "carton",
        unit: "unit",
        roll: "roll",
        pack: "pack",
        set: "set",
        "box of 6 pieces": "box",
        "box of 5 pieces": "box",
        "pack of 6": "pack",
        "set of 3": "set",
        "carton (25 bottles)": "carton",
        "4.5 lit gallon": "gallon",
        "sack (50 packets)": "sack",
        "bottle of 200/250ml": "bottle",
    };

    return map[unit] ?? unit.replace(/\s+/g, " ");
};

const parseVariants = (lines: string[]): string[] => {
    if (lines.length <= 1) {
        return [];
    }

    const variants: string[] = [];
    for (const line of lines.slice(1)) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Split paired tokens like "21mm 25mm" or "Sx ." or "S1 S1"
        const parts = trimmed
            .split(/\s{2,}|\s+\/\s+/)
            .flatMap((part) => part.split(/\s+/))
            .map((p) => p.replace(/\.$/, "").trim())
            .filter(Boolean);

        for (const part of parts) {
            const normalized = part.replace(/\s+/g, " ");
            if (
                normalized.length > 0 &&
                !variants.some((v) => normalizeKey(v) === normalizeKey(normalized))
            ) {
                variants.push(normalized);
            }
        }
    }

    return variants.slice(0, 20);
};

const resolveCategory = (itemName: string, csvCategory: string): string => {
    const key = normalizeKey(itemName);
    if (CATEGORY_MAP[key]) {
        return CATEGORY_MAP[key];
    }
    if (EQUIPMENT_NAMES.has(key)) {
        return "Equipment";
    }
    if (PPE_NAMES.has(key)) {
        return "PPE";
    }
    if (csvCategory.trim()) {
        return csvCategory.trim();
    }
    return "Consumables";
};

const skuPrefixForCategory = (category: string): string => {
    const map: Record<string, string> = {
        "Sterilization & Consumables": "CON",
        "Cotton & Basic Materials": "CTN",
        "Dental Materials": "MAT",
        "Filling Materials": "FIL",
        Accessories: "ACC",
        Endodontics: "END",
        Chemicals: "CHM",
        Surgical: "SUR",
        Equipment: "EQP",
        PPE: "PPE",
        General: "GEN",
        Consumables: "CON",
    };
    return map[category] ?? "INV";
};

const escapeCsv = (value: string) => {
    if (/[",\n\r]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
};

type CleanRow = {
    itemName: string;
    categoryName: string;
    clinic: string;
    sku: string;
    unit: string;
    minimumStockLevel: number;
    variants: string;
    description: string;
    inStock: number;
    isActive: boolean;
};

const main = () => {
    const content = readFileSync(INPUT_PATH, "utf8");
    const rows = parseCsv(content);
    const header = rows[0];
    if (!header?.[0]?.toLowerCase().includes("item_name")) {
        throw new Error("Unexpected CSV header");
    }

    const seen = new Set<string>();
    const cleanRows: CleanRow[] = [];
    const skuCounters: Record<string, number> = {};

    for (const cols of rows.slice(1)) {
        const rawName = (cols[0] ?? "").trim();
        if (!rawName) continue;

        const nameLines = rawName.split("\n").map((l) => l.trim()).filter(Boolean);
        const rawBase = nameLines[0] ?? rawName;
        const key = normalizeKey(rawBase);
        const baseName = NAME_OVERRIDES[key] ?? titleCase(rawBase);

        if (key === "item_name" || seen.has(key)) {
            continue;
        }
        seen.add(key);

        const csvCategory = (cols[1] ?? "").trim();
        const categoryName = resolveCategory(rawBase, csvCategory);
        const variants =
            VARIANT_OVERRIDES[key] ?? parseVariants(nameLines);
        const unit = normalizeUnit(cols[4] ?? "", categoryName);
        const minimumStockLevel = parseMinStock(cols[5] ?? "", variants.length);

        const prefix = skuPrefixForCategory(categoryName);
        skuCounters[prefix] = (skuCounters[prefix] ?? 0) + 1;
        const sku =
            (cols[3] ?? "").trim() ||
            `${prefix}-${String(skuCounters[prefix]).padStart(3, "0")}`;

        const inStock = Math.max(
            minimumStockLevel,
            Math.ceil(minimumStockLevel * 1.5)
        );

        cleanRows.push({
            itemName: baseName,
            categoryName,
            clinic: "",
            sku,
            unit,
            minimumStockLevel,
            variants: variants.join("|"),
            description: `${baseName} — ${categoryName.toLowerCase()} inventory item`,
            inStock,
            isActive: true,
        });
    }

    const outputHeader = [
        "item_name",
        "category_name",
        "clinic",
        "sku",
        "unit",
        "minimum_stock_level",
        "variants",
        "description",
        "in_stock",
        "is_active",
    ];

    const lines = [
        outputHeader.join(","),
        ...cleanRows.map((row) =>
            [
                escapeCsv(row.itemName),
                escapeCsv(row.categoryName),
                escapeCsv(row.clinic),
                escapeCsv(row.sku),
                escapeCsv(row.unit),
                String(row.minimumStockLevel),
                escapeCsv(row.variants),
                escapeCsv(row.description),
                String(row.inStock),
                row.isActive ? "true" : "false",
            ].join(",")
        ),
    ];

    writeFileSync(OUTPUT_PATH, `${lines.join("\n")}\n`, "utf8");

    console.log(`Wrote ${cleanRows.length} rows to:\n${OUTPUT_PATH}`);
};

main();
