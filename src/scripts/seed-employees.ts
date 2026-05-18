import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { employeeRoleAssignments } from "../db/schema/employeeRoleAssignments";
import { employees } from "../db/schema/employees";
import { employeeRoles } from "../db/schema/roles";
import {
    resolveRolesFromDesignation,
    SALT_ROUNDS,
} from "../modules/auth/auth.constants";
import { seedClinics } from "./seed/seed-clinics";

const DEFAULT_EMPLOYEE_PASSWORD = "Employee@123";

type SeedEmployee = {
    id: number;
    name: string;
    designation: string;
    clinic_id: number;
    timings: string;
};

const slugify = (value: string) =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ".")
        .replace(/^\.+|\.+$/g, "");

const buildEmail = (employee: SeedEmployee) => {
    const slug = slugify(employee.name) || `employee-${employee.id}`;
    return `${slug}.${employee.clinic_id}@yourvcare.com`;
};

const seedEmployeeRoles = async () => {
    const roleNames = [
        "Doctor",
        "Assistant",
        "HR Head",
        "HR Assistant",
        "Lab Technician",
        "Phlebotomist",
        "Reception",
        "Super Admin",
        "Director",
    ];

    for (const name of roleNames) {
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

const seedEmployees = async (
    records: SeedEmployee[],
    clinicMap: Map<number, string>
) => {
    const hashedPassword = await bcrypt.hash(
        DEFAULT_EMPLOYEE_PASSWORD,
        SALT_ROUNDS
    );

    for (const record of records) {
        const [existing] = await db
            .select({ id: employees.id })
            .from(employees)
            .where(eq(employees.legacyId, record.id));

        if (existing) {
            console.log(`Skipping employee #${record.id} (already exists)`);
            continue;
        }

        const clinicId = clinicMap.get(record.clinic_id);
        if (!clinicId) {
            throw new Error(`Clinic ${record.clinic_id} is not configured`);
        }

        const roleNames = resolveRolesFromDesignation(record.designation);

        const [employee] = await db
            .insert(employees)
            .values({
                legacyId: record.id,
                clinicId,
                name: record.name,
                email: buildEmail(record),
                password: hashedPassword,
                phone: "",
                designation: record.designation,
                timings: record.timings,
            })
            .returning();

        for (const roleName of roleNames) {
            const roleId = await getRoleIdByName(roleName);
            await db
                .insert(employeeRoleAssignments)
                .values({
                    employeeId: employee.id,
                    roleId,
                })
                .onConflictDoNothing();
        }

        console.log(
            `Created #${record.id} ${record.name} → roles: ${roleNames.join(", ")}`
        );
    }
};

const main = async () => {
    const filePath = join(process.cwd(), "drizzle/seed/employees.json");
    const { employees: records } = JSON.parse(
        readFileSync(filePath, "utf-8")
    ) as { employees: SeedEmployee[] };

    await seedEmployeeRoles();
    const clinicMap = await seedClinics();
    await seedEmployees(records, clinicMap);

    console.log(`\nSeeded ${records.length} employees (skips existing).`);
    console.log(`Default password: ${DEFAULT_EMPLOYEE_PASSWORD}`);
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
