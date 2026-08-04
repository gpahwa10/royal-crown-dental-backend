import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { clinics } from "../db/schema/clinic";
import { employeeRoleAssignments } from "../db/schema/employeeRoleAssignments";
import { employees } from "../db/schema/employees";
import { employeeRoles } from "../db/schema/roles";
import { superAdmins } from "../db/schema/superAdmins";
import {
    EMPLOYEE_ROLES,
    ROLE_DIRECTOR,
    ROLE_HR_HEAD,
    ROLE_INVENTORY_MANAGER,
    ROLE_LAB_TECHNICIAN,
    ROLE_RECEPTION,
    ROLE_CLINIC_HEAD,
    SALT_ROUNDS,
} from "../modules/auth/auth.constants";

const MANAGEMENT_PASSWORD = "Management@123";
const STAFF_PASSWORD = "Employee@123";

const CSV_PATH = join(
    process.cwd(),
    "src/scripts/new-data/YourVCare Master Data - Employees.csv"
);

type CsvEmployee = {
    legacyId: number;
    name: string;
    phone: string;
    email: string;
    position: string;
    status: string;
    branch: string;
    clinicId: string;
    timings: string | null;
    designation: string;
    roles: string[];
    password: string;
};

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

const cleanText = (value?: string | null) => {
    if (value === undefined || value === null) {
        return "";
    }
    return value.replace(/\s+/g, " ").trim();
};

const normalizePhone = (value?: string | null) =>
    cleanText(value).replace(/[^\d+]/g, "").slice(0, 255);

const normalizeHeader = (header: string) =>
    header.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^\w/]/g, "");

const mapPositionToRoles = (
    position: string,
    branch: string
): { designation: string; roles: string[] } => {
    const pos = position.trim().toLowerCase();
    const br = branch.trim().toLowerCase();

    if (pos === "founder" || pos === "co-founder") {
        return { designation: ROLE_DIRECTOR, roles: [ROLE_DIRECTOR] };
    }

    if (pos === "hr head" || br.includes("hr head")) {
        return { designation: ROLE_HR_HEAD, roles: [ROLE_HR_HEAD] };
    }

    if (pos === "doctor") {
        return { designation: "Doctor", roles: ["Doctor"] };
    }

    if (pos === "assistant") {
        return { designation: "Assistant", roles: ["Assistant"] };
    }

    if (pos === "fde") {
        return { designation: ROLE_RECEPTION, roles: [ROLE_RECEPTION] };
    }

    if (pos === "lab") {
        return {
            designation: ROLE_LAB_TECHNICIAN,
            roles: [ROLE_LAB_TECHNICIAN],
        };
    }

    if (pos === "retail") {
        return {
            designation: ROLE_INVENTORY_MANAGER,
            roles: [ROLE_INVENTORY_MANAGER],
        };
    }

    if (pos === "admin") {
        return { designation: ROLE_CLINIC_HEAD, roles: [ROLE_CLINIC_HEAD] };
    }

    throw new Error(`Unsupported position "${position}"`);
};

const isManagementRole = (roles: string[]) =>
    roles.includes(ROLE_DIRECTOR) || roles.includes(ROLE_HR_HEAD);

const makeUniqueEmail = (email: string, usedEmails: Set<string>, legacyId: number) => {
    const normalized = email.toLowerCase();
    if (!usedEmails.has(normalized)) {
        usedEmails.add(normalized);
        return normalized;
    }

    const [local, domain] = normalized.split("@");
    const unique = `${local}+${legacyId}@${domain ?? "yourvcare.com"}`;
    usedEmails.add(unique);
    console.warn(
        `Duplicate email "${email}" → using "${unique}" for legacy #${legacyId}`
    );
    return unique;
};

export const loadEmployeesFromCsv = (
    filePath: string = CSV_PATH
): CsvEmployee[] => {
    const rows = parseCsv(readFileSync(filePath, "utf-8"));
    if (rows.length < 2) {
        throw new Error(`No employee rows found in ${filePath}`);
    }

    const headers = rows[0].map(normalizeHeader);
    const idx = (name: string) => headers.indexOf(name);

    const nameIdx = idx("first_name");
    const phoneIdx = idx("phone");
    const emailIdx = idx("email");
    const positionIdx = idx("position");
    const statusIdx = idx("center_/_notes") >= 0 ? idx("center_/_notes") : idx("center__notes");
    // After normalize: "center_/_notes" might become "center_/_notes" - check actual
    const notesIdx =
        headers.findIndex((h) => h.includes("center") || h.includes("notes")) >= 0
            ? headers.findIndex((h) => h.includes("center") || h.includes("notes"))
            : statusIdx;
    const branchIdx = idx("branch");
    const clinicIdIdx = idx("clinicid");
    const timingsIdx = idx("timings");

    if (
        nameIdx < 0 ||
        emailIdx < 0 ||
        positionIdx < 0 ||
        clinicIdIdx < 0
    ) {
        throw new Error(
            `CSV missing required columns. Found: ${headers.join(", ")}`
        );
    }

    const usedEmails = new Set<string>();
    const records: CsvEmployee[] = [];
    let legacyId = 1;

    for (const row of rows.slice(1)) {
        while (row.length < headers.length) {
            row.push("");
        }

        const name = cleanText(row[nameIdx]);
        const rawEmail = cleanText(row[emailIdx]).toLowerCase();
        const position = cleanText(row[positionIdx]);
        const branch = cleanText(row[branchIdx]);
        const clinicId = cleanText(row[clinicIdIdx]);

        if (!name || !rawEmail || !position || !clinicId) {
            console.warn(`Skipping incomplete row #${legacyId}: ${name || rawEmail}`);
            legacyId += 1;
            continue;
        }

        const { designation, roles } = mapPositionToRoles(position, branch);
        const email = makeUniqueEmail(rawEmail, usedEmails, legacyId);
        const status = cleanText(row[notesIdx >= 0 ? notesIdx : -1] || "Active");

        records.push({
            legacyId,
            name,
            phone: normalizePhone(row[phoneIdx]),
            email,
            position,
            status,
            branch,
            clinicId,
            timings: cleanText(row[timingsIdx]) || null,
            designation,
            roles,
            password: isManagementRole(roles)
                ? MANAGEMENT_PASSWORD
                : STAFF_PASSWORD,
        });

        legacyId += 1;
    }

    return records;
};

const seedEmployeeRoles = async () => {
    for (const name of EMPLOYEE_ROLES) {
        await db
            .insert(employeeRoles)
            .values({ name })
            .onConflictDoNothing({ target: employeeRoles.name });
    }
};

const getRoleIdByName = async (name: string) => {
    const [role] = await db
        .select()
        .from(employeeRoles)
        .where(eq(employeeRoles.name, name));

    if (!role) {
        throw new Error(`Role "${name}" is not configured`);
    }

    return role.id;
};

const assertClinicExists = async (clinicId: string) => {
    const [clinic] = await db
        .select({ id: clinics.id, clinicName: clinics.clinicName })
        .from(clinics)
        .where(eq(clinics.id, clinicId));

    if (!clinic) {
        throw new Error(`Clinic ${clinicId} not found in database`);
    }

    return clinic;
};

const seedEmployeesFromCsv = async (records: CsvEmployee[]) => {
    const managementHash = await bcrypt.hash(MANAGEMENT_PASSWORD, SALT_ROUNDS);
    const staffHash = await bcrypt.hash(STAFF_PASSWORD, SALT_ROUNDS);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const record of records) {
        await assertClinicExists(record.clinicId);

        const passwordHash = isManagementRole(record.roles)
            ? managementHash
            : staffHash;

        const isActive = !["inactive", "false", "0", "no"].includes(
            record.status.toLowerCase()
        );

        const [existingByEmail] = await db
            .select()
            .from(employees)
            .where(eq(employees.email, record.email));

        const [existingByLegacy] = existingByEmail
            ? [null]
            : await db
                  .select()
                  .from(employees)
                  .where(eq(employees.legacyId, record.legacyId));

        const existing = existingByEmail ?? existingByLegacy;

        if (existing) {
            await db
                .update(employees)
                .set({
                    clinicId: record.clinicId,
                    name: record.name,
                    phone: record.phone,
                    password: passwordHash,
                    designation: record.designation,
                    timings: record.timings,
                    isActive,
                    legacyId: record.legacyId,
                    updatedAt: new Date(),
                })
                .where(eq(employees.id, existing.id));

            await db
                .delete(employeeRoleAssignments)
                .where(eq(employeeRoleAssignments.employeeId, existing.id));

            for (const roleName of record.roles) {
                const roleId = await getRoleIdByName(roleName);
                await db.insert(employeeRoleAssignments).values({
                    employeeId: existing.id,
                    roleId,
                });
            }

            updated += 1;
            console.log(
                `Updated #${record.legacyId} ${record.name} → ${record.roles.join(", ")} (${record.branch})`
            );
            continue;
        }

        const [employee] = await db
            .insert(employees)
            .values({
                legacyId: record.legacyId,
                clinicId: record.clinicId,
                name: record.name,
                email: record.email,
                password: passwordHash,
                phone: record.phone,
                designation: record.designation,
                timings: record.timings,
                isActive,
            })
            .returning();

        for (const roleName of record.roles) {
            const roleId = await getRoleIdByName(roleName);
            await db.insert(employeeRoleAssignments).values({
                employeeId: employee.id,
                roleId,
            });
        }

        created += 1;
        console.log(
            `Created #${record.legacyId} ${record.name} → ${record.roles.join(", ")} (${record.branch})`
        );
    }

    return { created, updated, skipped };
};

/** Seed Founder as platform Super Admin (separate from employee Director role). */
const seedSuperAdminFromFounder = async (records: CsvEmployee[]) => {
    const founder = records.find(
        (r) => r.position.trim().toLowerCase() === "founder"
    );
    if (!founder) {
        console.warn("No Founder row found; skipping super_admins seed.");
        return;
    }

    const hashedPassword = await bcrypt.hash(MANAGEMENT_PASSWORD, SALT_ROUNDS);
    const [existing] = await db
        .select({ id: superAdmins.id })
        .from(superAdmins)
        .where(eq(superAdmins.email, founder.email));

    if (existing) {
        await db
            .update(superAdmins)
            .set({
                name: founder.name,
                password: hashedPassword,
                isActive: true,
                updatedAt: new Date(),
            })
            .where(eq(superAdmins.id, existing.id));
        console.log(`Updated Super Admin: ${founder.email}`);
        return;
    }

    await db.insert(superAdmins).values({
        name: founder.name,
        email: founder.email,
        password: hashedPassword,
    });
    console.log(`Created Super Admin: ${founder.email}`);
};

const main = async () => {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is not set");
    }

    const records = loadEmployeesFromCsv();
    console.log(`Loaded ${records.length} employees from CSV.`);

    const managementCount = records.filter((r) =>
        isManagementRole(r.roles)
    ).length;
    console.log(
        `Passwords: ${managementCount} management → ${MANAGEMENT_PASSWORD}; ${
            records.length - managementCount
        } staff → ${STAFF_PASSWORD}`
    );

    await seedEmployeeRoles();
    await seedSuperAdminFromFounder(records);
    const result = await seedEmployeesFromCsv(records);

    console.log(
        `\nDone. created=${result.created}, updated=${result.updated}, skipped=${result.skipped}`
    );
    console.log(`Management password: ${MANAGEMENT_PASSWORD}`);
    console.log(`Staff password: ${STAFF_PASSWORD}`);
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
